// One-time, re-runnable data migration (#653): back-fill the `balance_received` step's stored
// `autoCompleteRule`.
//
// #653 gave `balance_received` an `invoicePaid` rule (it was `null`). Evaluation is
// catalogue-driven — `STEP_PREDICATES` is built from `CHECKLIST_DEFAULTS` keyed by step key — so
// already-seeded bookings evaluate the new rule immediately, no data change required. But the
// frontend "Mark as paid" CTA is derived from the *stored* `step.autoCompleteRule` (getChecklist →
// deriveShortcut), which stays `null` on rows seeded before this ships. This migration patches
// those stored rows (apply script) and every user's saved checklist template (planner below) so the
// CTA appears on existing bookings too, and leaves the stored data consistent with the catalogue.
//
// PURE planner — no DB access — unit-tested on fixtures. The apply step (row update + evaluate()
// sweep + template update) lives in `scripts/migrate-balance-received-rule.ts`.
import { CHECKLIST_DEFAULTS, ChecklistDefaultItem } from '../bookings/checklist-defaults';

export const BALANCE_GOAL_KEY = 'get_the_balance_paid';
export const BALANCE_STEP_KEY = 'balance_received';

/** The canonical `balance_received` rule, sourced from the catalogue (single source of truth). */
export function canonicalBalanceRule(): Record<string, unknown> {
  const goal = CHECKLIST_DEFAULTS.find((d) => d.key === BALANCE_GOAL_KEY);
  const step = goal?.steps?.find((s) => s.key === BALANCE_STEP_KEY);
  if (!step?.autoCompleteRule) {
    throw new Error(`Canonical ${BALANCE_STEP_KEY} rule not found in CHECKLIST_DEFAULTS`);
  }
  return step.autoCompleteRule;
}

/** True when a stored rule already carries the `invoicePaid` type — the idempotency guard. */
export function isBalanceRuleCurrent(rule: unknown): boolean {
  return (
    !!rule && typeof rule === 'object' && (rule as Record<string, unknown>).type === 'invoicePaid'
  );
}

/**
 * Patch the `balance_received` step's rule inside a user's *saved* checklist template. Returns the
 * updated array, or null when there is nothing to do — no `get_the_balance_paid` goal, no
 * `balance_received` step, or the rule is already current (idempotent).
 */
export function planBalanceTemplateMigration(
  storedDefaults: ChecklistDefaultItem[],
): ChecklistDefaultItem[] | null {
  const goalIdx = storedDefaults.findIndex((d) => d.key === BALANCE_GOAL_KEY);
  if (goalIdx === -1) return null;
  const goal = storedDefaults[goalIdx];
  const steps = goal.steps;
  if (!steps?.length) return null;
  const stepIdx = steps.findIndex((s) => s.key === BALANCE_STEP_KEY);
  if (stepIdx === -1) return null;
  if (isBalanceRuleCurrent(steps[stepIdx].autoCompleteRule)) return null;

  const nextSteps = steps.map((s, i) =>
    i === stepIdx ? { ...s, autoCompleteRule: canonicalBalanceRule() } : s,
  );
  const result = [...storedDefaults];
  result[goalIdx] = { ...goal, steps: nextSteps };
  return result;
}
