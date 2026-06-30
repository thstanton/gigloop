// One-time, re-runnable data migration (ADR-0057 / #617): reshape the deposit and balance billing
// goals from their old step spines into the new 4-step shape (create → issue → send → received),
// and rename the balance goal `invoice_the_balance` → `get_the_balance_paid`.
//
// Unlike the #616 quote collapse (flat items → a new goal), this operates on goals that are ALREADY
// multi-step: it rebuilds a goal's steps to the canonical catalogue shape, carrying each existing
// step's state/completedAt by key and inserting the new steps. Because invoices/communications are
// canonical, the post-migration evaluate() reconstructs every step that HAS a rule from live facts
// — so the planner only hand-carries state for the new no-signal step (`balance_received`, which
// has no rule): on an already-complete balance goal it is set COMPLETE so a settled balance never
// re-nags (Story 21). A monotonic back-fill (a later COMPLETE implies its predecessors) is the
// belt-and-suspenders for an invoice voided after issue.
//
// PURE planner — no DB access — unit-tested on fixtures. The apply step (transaction + per-goal
// step rebuild + evaluate() sweep) lives in `scripts/migrate-invoice-goals.ts`.
import { CHECKLIST_DEFAULTS, ChecklistDefaultItem } from '../bookings/checklist-defaults';
import { ChecklistState, StepState, rollUp } from './checklist-rollup';

/** The subset of an existing step row the planner reads. */
export interface ExistingStep {
  key: string | null;
  state: string;
  completedAt: Date | null;
}

/** A step row the migration will (re)create. */
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

export interface InvoiceGoalMigrationPlan {
  newGoalKey: string;
  newGoalLabel: string;
  goalState: ChecklistState;
  goalCompletedAt: Date | null;
  steps: PlannedStep[];
}

function toStepState(s: string): StepState {
  if (s === 'COMPLETE') return 'COMPLETE';
  if (s === 'FAILED') return 'FAILED';
  return 'PENDING';
}

/**
 * Reshape one invoice goal's steps to the canonical 4-step spine of `canonicalGoalKey`. Returns
 * null when the goal is already in canonical shape (every canonical step key present) — idempotent.
 *
 * `oldGoalState` carries the existing goal's roll-up state so a NEW no-signal terminal step
 * (`balance_received`) inherits a completed goal's done-state instead of re-opening it.
 */
export function planInvoiceGoalMigration(
  canonicalGoalKey: string,
  oldGoalState: string,
  existingSteps: ExistingStep[],
): InvoiceGoalMigrationPlan | null {
  const def = CHECKLIST_DEFAULTS.find((d) => d.key === canonicalGoalKey);
  if (!def || !def.steps?.length) {
    throw new Error(`Canonical ${canonicalGoalKey} goal with steps not found in CHECKLIST_DEFAULTS`);
  }
  const stepDefs = def.steps;
  const canonicalKeys = stepDefs.map((s) => s.key);

  const existingByKey = new Map(
    existingSteps.filter((s) => s.key != null).map((s) => [s.key as string, s]),
  );
  // Idempotent: the goal is already in the canonical shape (every canonical step present).
  if (canonicalKeys.every((k) => existingByKey.has(k))) return null;

  const steps: PlannedStep[] = stepDefs.map((sDef, idx) => {
    const old = existingByKey.get(sDef.key);
    let state: StepState;
    let completedAt: Date | null;
    if (old) {
      state = toStepState(old.state);
      completedAt = state === 'COMPLETE' ? old.completedAt : null;
    } else if (sDef.autoCompleteRule == null && oldGoalState === 'COMPLETE') {
      // A NEW no-signal terminal step (balance_received) on an already-complete goal carries the
      // goal's completion — a settled balance must not re-nag (Story 21). No completedAt source.
      state = 'COMPLETE';
      completedAt = null;
    } else {
      state = 'PENDING';
      completedAt = null;
    }
    return {
      key: sDef.key,
      label: sDef.label,
      order: idx + 1,
      kind: sDef.kind,
      completeMode: sDef.completeMode,
      completedBy: sDef.completedBy,
      state,
      completedAt,
      autoCompleteRule: (sDef.autoCompleteRule as Record<string, unknown> | null) ?? null,
      dueDateRule: (sDef.dueDateRule as Record<string, unknown> | null) ?? null,
    };
  });

  // Monotonic back-fill: a later COMPLETE implies its predecessors are done. FAILED untouched.
  let seen = false;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].state === 'COMPLETE') seen = true;
    else if (seen && steps[i].state === 'PENDING') steps[i].state = 'COMPLETE';
  }

  const goalState = rollUp(steps.map((s) => ({ state: s.state })));
  const goalCompletedAt =
    goalState === 'COMPLETE'
      ? steps.reduce<Date | null>(
          (latest, s) =>
            s.completedAt && (!latest || s.completedAt > latest) ? s.completedAt : latest,
          null,
        )
      : null;

  return { newGoalKey: def.key, newGoalLabel: def.label, goalState, goalCompletedAt, steps };
}

/**
 * Migrate a user's *saved* checklist template: rename the `invoice_the_balance` entry to the
 * canonical `get_the_balance_paid` goal (carrying the user's enabled/dueDateRule overrides) so new
 * bookings seed the renamed goal. The deposit goal keeps its key, so it needs no template change.
 * Returns null when the template has no `invoice_the_balance` entry.
 */
export function planInvoiceTemplateMigration(
  storedDefaults: ChecklistDefaultItem[],
): ChecklistDefaultItem[] | null {
  const idx = storedDefaults.findIndex((d) => d.key === 'invoice_the_balance');
  if (idx === -1) return null;
  const def = CHECKLIST_DEFAULTS.find((d) => d.key === 'get_the_balance_paid');
  if (!def) {
    throw new Error('Canonical get_the_balance_paid goal not found in CHECKLIST_DEFAULTS');
  }
  const old = storedDefaults[idx];
  const renamed: ChecklistDefaultItem = {
    ...def,
    ...(old.enabled === false ? { enabled: false } : {}),
    // Carry the user's dueDateRule override (always present on a stored entry — null or a value).
    dueDateRule: old.dueDateRule,
  };
  const result = [...storedDefaults];
  result[idx] = renamed;
  return result;
}
