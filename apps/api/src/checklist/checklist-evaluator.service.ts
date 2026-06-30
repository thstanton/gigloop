import { Injectable } from '@nestjs/common';
import { ChecklistRepository } from './checklist.repository';
import {
  AutoCompleteRule,
  BookingContext,
  InputKey,
  RuleState,
  evaluateRuleState,
} from './checklist-rules';
import { ChecklistState, StepState, rollUp } from './checklist-rollup';
import { STEP_PREDICATES, affectedKeys } from './checklist-predicate-registry';

const STATUS_ORDER = ['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'];

function statusGte(current: string, threshold: string): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}

// Goals that become SKIPPED when booking status reaches a threshold. The contract
// outcome is an awaited goal the READY transition makes moot (the gig is happening) —
// it is skipped, not failed. Keyed on the GOAL (`get_contract_signed`) now that the
// contract is a multi-step goal; resolveSkip sets the goal SKIPPED directly, ahead of
// any step roll-up. (Pre-#607 this keyed on the flat `contract_signed` item.)
const SKIP_RULES: Array<{ keys: string[]; threshold: string }> = [
  { keys: ['get_contract_signed'], threshold: 'READY' },
];

/**
 * A dependency is *satisfied* (does not block downstream) when it is COMPLETE,
 * SKIPPED, or absent. Retained for the reminders selector's "after you …" clause
 * (ADR-0052). The evaluator itself no longer consults it: ADR-0057 retires the
 * BLOCKED state and `dependsOn` gating — intra-goal order is intrinsic `step.order`
 * (the active step is derived, never stored) and inter-goal order is soft status.
 */
export function isDepSatisfied(depKey: string, stateMap: Map<string, string>): boolean {
  const depState = stateMap.get(depKey);
  return depState === undefined || depState === 'COMPLETE' || depState === 'SKIPPED';
}

type EvalStep = {
  id: string;
  key: string | null;
  state: string;
  completedAt: Date | null;
};

/** A Goal: the user-facing checklist row. Atomic goals carry their own rule and
 * have no steps; multi-step goals roll their state up from `steps`. */
type EvalGoal = {
  id: string;
  key: string | null;
  state: string;
  completedAt: Date | null;
  autoCompleteRule: unknown;
  steps?: EvalStep[];
};

type StateUpdate = { id: string; state: string; completedAt?: Date | null };

function isTerminalGoal(state: string): boolean {
  return state === 'COMPLETE' || state === 'SKIPPED';
}

function resolveSkip(goal: EvalGoal, bookingStatus: string): boolean {
  return SKIP_RULES.some(
    ({ keys, threshold }) =>
      goal.key && keys.includes(goal.key) && statusGte(bookingStatus, threshold),
  );
}

/** Re-evaluate a single step against the registry, respecting COMPLETE stickiness.
 * A step with no registered predicate keeps its stored state. */
function nextStepState(step: EvalStep, ctx: BookingContext): RuleState {
  if (step.state === 'COMPLETE') return 'COMPLETE'; // sticky — manual or prior auto-complete
  const entry = step.key ? STEP_PREDICATES[step.key] : undefined;
  if (!entry) return step.state as RuleState;
  return entry.predicate(ctx);
}

/**
 * The materialised next state of a goal, plus any step transitions it implies.
 * Multi-step goals re-evaluate their steps and roll up; atomic goals evaluate
 * their own rule. Never returns BLOCKED.
 */
function nextGoalState(
  goal: EvalGoal,
  ctx: BookingContext,
): { state: ChecklistState; stepUpdates: StateUpdate[] } {
  if (goal.steps && goal.steps.length > 0) {
    const stepUpdates: StateUpdate[] = [];
    const rolled = goal.steps.map((step) => {
      const next = nextStepState(step, ctx);
      if (next !== step.state) {
        const update: StateUpdate = { id: step.id, state: next };
        if (next === 'COMPLETE') update.completedAt = new Date();
        else if (step.completedAt) update.completedAt = null;
        stepUpdates.push(update);
      }
      return { state: next as StepState };
    });
    return { state: rollUp(rolled), stepUpdates };
  }
  const rule = goal.autoCompleteRule as AutoCompleteRule | null;
  return { state: rule ? evaluateRuleState(rule, ctx) : 'PENDING', stepUpdates: [] };
}

/** Build a sparse goal update, or null when the state is unchanged. */
function buildGoalUpdate(goal: EvalGoal, newState: ChecklistState): StateUpdate | null {
  if (newState === goal.state) return null;
  const update: StateUpdate = { id: goal.id, state: newState };
  if (newState === 'COMPLETE') update.completedAt = new Date();
  else if (goal.completedAt) update.completedAt = null;
  return update;
}

/** Evaluate one goal (SKIP rule first), returning its goal update and step updates. */
function evaluateGoal(
  goal: EvalGoal,
  ctx: BookingContext,
): { goalUpdate: StateUpdate | null; stepUpdates: StateUpdate[] } {
  if (resolveSkip(goal, ctx.status)) {
    return { goalUpdate: buildGoalUpdate(goal, 'SKIPPED'), stepUpdates: [] };
  }
  const { state, stepUpdates } = nextGoalState(goal, ctx);
  return { goalUpdate: buildGoalUpdate(goal, state), stepUpdates };
}

/** Whether an event touching `keys` can move this goal (its own key, or any step). */
function goalIsAffected(goal: EvalGoal, keys: Set<string>): boolean {
  if (goal.steps && goal.steps.length > 0) {
    return goal.steps.some((s) => s.key != null && keys.has(s.key));
  }
  return goal.key != null && keys.has(goal.key);
}

function computeUpdates(
  goals: EvalGoal[],
  ctx: BookingContext,
): { goalUpdates: StateUpdate[]; stepUpdates: StateUpdate[] } {
  const goalUpdates: StateUpdate[] = [];
  const stepUpdates: StateUpdate[] = [];
  for (const goal of goals) {
    if (isTerminalGoal(goal.state)) continue; // COMPLETE/SKIPPED are sticky
    const { goalUpdate, stepUpdates: steps } = evaluateGoal(goal, ctx);
    if (goalUpdate) goalUpdates.push(goalUpdate);
    stepUpdates.push(...steps);
  }
  return { goalUpdates, stepUpdates };
}

@Injectable()
export class ChecklistEvaluatorService {
  constructor(private repo: ChecklistRepository) {}

  /**
   * Full-sweep evaluation — re-evaluates every non-terminal goal. The entry point
   * for booking creation, the data migration, and booking-date changes, where the
   * affected set is unknown. Event-driven call sites can use {@link evaluateForEvent}.
   */
  async evaluate(bookingId: string): Promise<void> {
    const { items, booking } = await this.repo.findItemsWithContext(bookingId);
    if (!booking || !items.length) return;
    const { goalUpdates, stepUpdates } = computeUpdates(
      items as EvalGoal[],
      booking as BookingContext,
    );
    // Goal state is a roll-up of its steps, so the two writes must land together —
    // a split write leaves a window where a goal reads COMPLETE while a step is still
    // PENDING. The repo applies both in one transaction.
    if (goalUpdates.length || stepUpdates.length) {
      await this.repo.applyStateUpdates(goalUpdates, stepUpdates);
    }
  }

  /**
   * Event-targeted evaluation (ADR-0057 containment): a business event resolves
   * its `changedInputs` to exactly the affected goals via the predicate registry's
   * inverted index, re-evaluating only those instead of the whole checklist.
   *
   * Built and unit-tested here. Production call sites currently stay on full-sweep
   * {@link evaluate} — it now persists step updates too, so it is correct for the
   * multi-step contract goal; the inverted-index path remains available for a later
   * containment pass without changing observable behaviour. Status/date-driven
   * re-evaluation must always use {@link evaluate}: the SKIP_RULES path keys on
   * booking status, which is not an InputKey the index can target.
   */
  async evaluateForEvent(bookingId: string, changedInputs: InputKey[]): Promise<void> {
    const { items, booking } = await this.repo.findItemsWithContext(bookingId);
    if (!booking || !items.length) return;
    const keys = affectedKeys(changedInputs);
    const targeted = (items as EvalGoal[]).filter((g) => goalIsAffected(g, keys));
    if (!targeted.length) return;
    const { goalUpdates, stepUpdates } = computeUpdates(targeted, booking as BookingContext);
    if (goalUpdates.length || stepUpdates.length) {
      await this.repo.applyStateUpdates(goalUpdates, stepUpdates);
    }
  }
}
