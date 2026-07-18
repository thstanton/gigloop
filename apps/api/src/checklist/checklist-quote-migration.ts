// One-time, re-runnable data migration (ADR-0057 / #616): collapse a booking's two flat quote
// items — `send_quote` and `confirm_quote` — into the single multi-step GOAL
// `get_the_quote_accepted` with its canonical child steps (`send_quote` → `quote_accepted`),
// carrying each old item's state, completedAt and the cluster's earliest deadline over. Every
// other flat item is left untouched (it is already an atomic goal or an already-collapsed goal).
//
// This specialises the #607/#608 flat-cluster collapse — frozen, prod-run, then deleted — to the
// quote, with ONE wrinkle the deposit/contract collapses did not have: the goal is outcome-framed
// now, so the old `confirm_quote` item is RENAMED onto the new `quote_accepted` step. The planner
// resolves each old key onto its canonical step key before overlaying state, so the confirmed
// state is preserved rather than orphaned (and the stale `confirm_quote` row is deleted).
//
// PURE planner — it computes the goal/step tree and the rows to delete from a booking's existing
// items with no DB access — so it is unit-tested directly on fixtures. The apply step
// (transaction + per-booking evaluate() sweep) lives in `scripts/migrate-quote-goals.ts`.
import { CHECKLIST_DEFAULTS } from '../bookings/checklist-defaults';
import { ChecklistState, StepState, rollUp } from './checklist-rollup';

const GOAL_KEY = 'get_the_quote_accepted';

// Old flat item key → canonical step key. `send_quote` keeps its key; `confirm_quote` is renamed
// onto the outcome-framed `quote_accepted` step so its recorded state migrates, not orphans.
const FLAT_TO_STEP: Record<string, string> = {
  send_quote: 'send_quote',
  confirm_quote: 'quote_accepted',
};

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
  /** Set when the goal rolls up to COMPLETE — the latest step completion. */
  completedAt: Date | null;
  dueDate: Date | null;
  dueDateRule: Record<string, unknown> | null;
  autoCompleteRule: null;
}

export interface QuoteMigrationPlan {
  goal: PlannedGoal;
  steps: PlannedStep[];
  /** Ids of the flat items to delete once the goal+steps exist. */
  deleteIds: string[];
}

// A step is only PENDING | COMPLETE | FAILED. The retired BLOCKED state, and a flat item the
// musician SKIPPED, both normalise to PENDING on the step — a goal-level skip is re-applied by
// the post-migration evaluate() sweep.
function toStepState(flatState: string): StepState {
  if (flatState === 'COMPLETE') return 'COMPLETE';
  if (flatState === 'FAILED') return 'FAILED';
  return 'PENDING';
}

/**
 * Plan the collapse of a booking's flat quote cluster, or return null when there is nothing to
 * do — already migrated (a `get_the_quote_accepted` goal row exists) or no quote cluster present.
 * Idempotent by construction: re-running over an already-migrated booking is a no-op.
 *
 * The migrated goal always carries the full canonical step spine; each step's state is overlaid
 * from the matching old flat item (by its resolved/renamed key), so a partial cluster still
 * yields a complete, consistent goal and never loses recorded state.
 */
export function planQuoteMigration(items: FlatChecklistItem[]): QuoteMigrationPlan | null {
  if (items.some((i) => i.key === GOAL_KEY)) return null;

  const def = CHECKLIST_DEFAULTS.find((d) => d.key === GOAL_KEY);
  if (!def || !def.steps?.length) {
    throw new Error(`Canonical ${GOAL_KEY} goal with steps not found in CHECKLIST_DEFAULTS`);
  }
  const stepDefs = def.steps;

  const oldKeys = Object.keys(FLAT_TO_STEP);
  const cluster = items.filter((i) => i.key != null && oldKeys.includes(i.key));
  if (cluster.length === 0) return null;

  // Index old items by their RESOLVED (renamed) step key, so `confirm_quote` overlays the
  // `quote_accepted` step.
  const byStepKey = new Map<string, FlatChecklistItem>();
  for (const i of cluster) byStepKey.set(FLAT_TO_STEP[i.key as string], i);

  const steps: PlannedStep[] = stepDefs.map((sDef, idx) => {
    const old = byStepKey.get(sDef.key);
    const state = old ? toStepState(old.state) : 'PENDING';
    return {
      key: sDef.key,
      label: sDef.label,
      order: idx + 1,
      kind: sDef.kind,
      completeMode: sDef.completeMode,
      completedBy: sDef.completedBy,
      state,
      completedAt: state === 'COMPLETE' ? (old?.completedAt ?? null) : null,
      autoCompleteRule: (sDef.autoCompleteRule as Record<string, unknown> | null) ?? null,
      dueDateRule: (sDef.dueDateRule as Record<string, unknown> | null) ?? null,
    };
  });

  // Monotonic back-fill of the milestone spine (identical to the #608 collapse): a deliverable
  // can't reach a later milestone without traversing the earlier ones, so a COMPLETE step implies
  // its predecessors are done. For the quote this means an *accepted* quote (the old
  // `confirm_quote` was COMPLETE → `quote_accepted` COMPLETE) back-fills `send_quote` to COMPLETE,
  // so an accepted-but-no-recorded-send booking migrates to a COMPLETE goal, never re-nagging
  // "Send the quote" (Story 21). A sent-but-unaccepted quote leaves `quote_accepted` PENDING (no
  // later COMPLETE to trigger fill) — correct: keep chasing the sale. Sweep last→first; FAILED is
  // left untouched (a real, surfaced state, not a gap).
  let seenComplete = false;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].state === 'COMPLETE') seenComplete = true;
    else if (seenComplete && steps[i].state === 'PENDING') steps[i].state = 'COMPLETE';
  }

  // The goal sits where the cluster was (lowest order) and dates against the cluster's earliest
  // stored deadline (generalising #607's "carry the send dueDate").
  const order = Math.min(...cluster.map((i) => i.order));
  const dueDate = cluster
    .map((i) => i.dueDate)
    .filter((d): d is Date => d != null)
    .reduce<Date | null>((earliest, d) => (!earliest || d < earliest ? d : earliest), null);
  const state = rollUp(steps.map((s) => ({ state: s.state })));
  const completedAt =
    state === 'COMPLETE'
      ? steps.reduce<Date | null>(
          (latest, s) =>
            s.completedAt && (!latest || s.completedAt > latest) ? s.completedAt : latest,
          null,
        )
      : null;

  const goal: PlannedGoal = {
    key: def.key,
    label: def.label,
    completedBy: def.completedBy,
    requiredForStatus: def.requiredForStatus,
    order,
    state,
    completedAt,
    dueDate,
    dueDateRule: (def.dueDateRule as Record<string, unknown> | null) ?? null,
    autoCompleteRule: null,
  };

  return { goal, steps, deleteIds: cluster.map((i) => i.id) };
}

// The saved-template migration (planQuoteTemplateMigration) was retired by ADR-0060: checklist
// defaults are now stored as sparse overrides and read-merged against the current catalogue, so a
// retired key is dropped on read and never needs a template rewrite. The booking-row planner
// (planQuoteMigration, above) is retained as the reusable reshape pattern for any future collapse.
