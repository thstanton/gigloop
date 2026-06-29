// One-time, re-runnable data migration (ADR-0057 / #607): collapse a booking's flat
// contract item-cluster (`create_contract`, `send_contract`, `contract_signed`) into a
// single `get_contract_signed` GOAL with its canonical child steps, carrying each old
// item's state, completedAt and the send deadline over. Every other flat item is left
// untouched (it is already an atomic goal).
//
// This file is the PURE planner — it computes the goal/step tree and the rows to delete
// from a booking's existing items, with no DB access — so it is unit-tested directly on
// fixtures. The apply step (transaction + per-booking sweep) lives in the script that
// imports it (`scripts/migrate-contract-goals.ts`).
import { CHECKLIST_DEFAULTS, ChecklistDefaultItem, ChecklistDefaultStep } from '../bookings/checklist-defaults';
import { ChecklistState, StepState, rollUp } from './checklist-rollup';

const CONTRACT_GOAL_KEY = 'get_contract_signed';
const OLD_CONTRACT_KEYS = ['create_contract', 'send_contract', 'contract_signed'];

// The canonical contract goal + its steps come from the single source of truth, so the
// migrated tree can never drift from what new bookings seed.
const CONTRACT_GOAL = CHECKLIST_DEFAULTS.find((d) => d.key === CONTRACT_GOAL_KEY);
if (!CONTRACT_GOAL || !CONTRACT_GOAL.steps?.length) {
  throw new Error('Canonical get_contract_signed goal with steps not found in CHECKLIST_DEFAULTS');
}
const CONTRACT_STEPS: ChecklistDefaultStep[] = CONTRACT_GOAL.steps;
const CONTRACT_STEP_KEYS: string[] = CONTRACT_STEPS.map((s) => s.key);

/** The subset of a flat checklist item the planner reads. */
export interface FlatChecklistItem {
  id: string;
  key: string | null;
  state: string;
  completedAt: Date | null;
  dueDate: Date | null;
  order: number;
}

/** A step row the migration will create (goalId/userId/bookingId are filled by the apply step). */
export interface PlannedStep {
  key: string;
  label: string;
  order: number;
  kind: string;
  completeMode: string;
  completedBy: string;
  state: StepState;
  completedAt: Date | null;
  autoCompleteRule: Record<string, unknown> | null;
  dueDateRule: Record<string, unknown> | null;
}

/** The goal row the migration will create. */
export interface PlannedGoal {
  key: string;
  label: string;
  completedBy: string;
  requiredForStatus: string | null;
  order: number;
  state: ChecklistState;
  /** Set when the goal rolls up to COMPLETE — the latest step completion (the signing). */
  completedAt: Date | null;
  dueDate: Date | null;
  dueDateRule: Record<string, unknown> | null;
  autoCompleteRule: null;
}

export interface ContractMigrationPlan {
  goal: PlannedGoal;
  steps: PlannedStep[];
  /** Ids of the flat contract items to delete once the goal+steps exist. */
  deleteIds: string[];
}

// A step is only PENDING | COMPLETE | FAILED. The retired BLOCKED state, and a flat item
// the musician SKIPPED, both normalise to PENDING on the step — the goal-level skip (the
// READY-makes-signing-moot rule) is re-applied by the post-migration evaluate() sweep.
function toStepState(flatState: string): StepState {
  if (flatState === 'COMPLETE') return 'COMPLETE';
  if (flatState === 'FAILED') return 'FAILED';
  return 'PENDING';
}

/**
 * Plan the contract collapse for one booking's flat items, or return null when there is
 * nothing to do — already migrated (a `get_contract_signed` goal exists) or no contract
 * cluster present. Idempotent by construction: re-running over an already-migrated
 * booking is a no-op.
 *
 * The migrated goal always carries the full canonical 3-step spine; each step's state is
 * overlaid from the matching old flat item by key (a missing item → a PENDING step), so a
 * partial cluster still yields a complete, consistent goal and never loses recorded state.
 */
export function planContractMigration(items: FlatChecklistItem[]): ContractMigrationPlan | null {
  if (items.some((i) => i.key === CONTRACT_GOAL_KEY)) return null;
  const cluster = items.filter((i) => i.key != null && CONTRACT_STEP_KEYS.includes(i.key));
  if (cluster.length === 0) return null;

  const byKey = new Map(cluster.map((i) => [i.key as string, i]));

  const steps: PlannedStep[] = CONTRACT_STEPS.map((def, idx) => {
    const old = byKey.get(def.key);
    const state = old ? toStepState(old.state) : 'PENDING';
    return {
      key: def.key,
      label: def.label,
      order: idx + 1,
      kind: def.kind,
      completeMode: def.completeMode,
      completedBy: def.completedBy,
      state,
      completedAt: state === 'COMPLETE' ? (old?.completedAt ?? null) : null,
      autoCompleteRule: def.autoCompleteRule ?? null,
      dueDateRule: (def.dueDateRule as Record<string, unknown> | null) ?? null,
    };
  });

  // The goal sits where the cluster was (lowest order) and carries the send deadline (the
  // existing send_contract dueDate, the -60 the goal dates against).
  const order = Math.min(...cluster.map((i) => i.order));
  const sendDueDate = byKey.get('send_contract')?.dueDate ?? null;
  const state = rollUp(steps.map((s) => ({ state: s.state })));
  // A fully-migrated (COMPLETE) goal carries a completion timestamp like a naturally
  // completed one would — the latest step completion (the client's signing).
  const completedAt =
    state === 'COMPLETE'
      ? steps.reduce<Date | null>(
          (latest, s) => (s.completedAt && (!latest || s.completedAt > latest) ? s.completedAt : latest),
          null,
        )
      : null;

  const goal: PlannedGoal = {
    key: CONTRACT_GOAL_KEY,
    label: CONTRACT_GOAL!.label,
    completedBy: CONTRACT_GOAL!.completedBy,
    requiredForStatus: CONTRACT_GOAL!.requiredForStatus,
    order,
    state,
    completedAt,
    dueDate: sendDueDate,
    dueDateRule: (CONTRACT_GOAL!.dueDateRule as Record<string, unknown> | null) ?? null,
    autoCompleteRule: null,
  };

  return { goal, steps, deleteIds: cluster.map((i) => i.id) };
}

/**
 * Migrate a user's *saved* checklist template (the full list stored in
 * `preferences.checklistDefaults`). A template saved before #607 is frozen with the
 * three flat contract entries; the New Booking form seeds the intersection of this
 * template with the backend reminder preview, so until it carries `get_contract_signed`
 * a new booking would drop the contract entirely (the old keys are no longer preview
 * keys). Collapsing the cluster to the canonical goal entry keeps new bookings seeding
 * the contract — AC1. Returns null when the template has no old contract keys (already
 * current, or empty so the system falls back to CHECKLIST_DEFAULTS, which is current).
 *
 * Other system items keep the user's enabled/dueDateRule overrides and order; custom
 * items are preserved. (A user-level disable of an individual contract *step* is not
 * carried — the contract is one goal now; the goal re-seeds enabled, re-disablable.)
 */
export function planTemplateMigration(
  storedDefaults: ChecklistDefaultItem[],
): ChecklistDefaultItem[] | null {
  if (!storedDefaults.some((d) => d.key != null && OLD_CONTRACT_KEYS.includes(d.key))) {
    return null;
  }
  const canonical = CHECKLIST_DEFAULTS.find((d) => d.key === CONTRACT_GOAL_KEY)!;
  const result: ChecklistDefaultItem[] = [];
  let inserted = false;
  for (const item of storedDefaults) {
    if (item.key != null && OLD_CONTRACT_KEYS.includes(item.key)) {
      if (!inserted) {
        result.push(canonical);
        inserted = true;
      }
      continue; // drop the old flat contract entries
    }
    result.push(item);
  }
  return result;
}
