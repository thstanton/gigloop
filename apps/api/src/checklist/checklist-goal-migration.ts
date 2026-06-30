// One-time, re-runnable data migration (ADR-0057 / #608): collapse a booking's flat
// item-cluster for a multi-step goal into a single GOAL with its canonical child steps,
// carrying each old item's state, completedAt and the cluster's earliest deadline over.
// Every other flat item is left untouched (it is already an atomic goal).
//
// This generalises the #607 contract migration to ANY goal key — the deposit
// (`get_deposit_paid`), balance (`invoice_the_balance`) and song-requests
// (`gather_song_requests`) clusters. The contract migration ships separately
// (checklist-contract-migration.ts) because it has already run against production; keeping
// it as the frozen historical record keeps the prod-run boundary clean.
//
// This file is the PURE planner — it computes the goal/step tree and the rows to delete from
// a booking's existing items, with no DB access — so it is unit-tested directly on fixtures.
// The apply step (transaction + per-booking sweep) lives in the script that imports it
// (`scripts/migrate-cluster-goals.ts`).
import {
  CHECKLIST_DEFAULTS,
  ChecklistDefaultItem,
  ChecklistDefaultStep,
} from '../bookings/checklist-defaults';
import { ChecklistState, StepState, rollUp } from './checklist-rollup';

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

export interface GoalMigrationPlan {
  goal: PlannedGoal;
  steps: PlannedStep[];
  /** Ids of the flat items to delete once the goal+steps exist. */
  deleteIds: string[];
}

/** Resolve a goal's canonical definition + step keys from the single source of truth, so the
 *  migrated tree can never drift from what new bookings seed. */
function canonicalGoal(goalKey: string): { def: ChecklistDefaultItem; steps: ChecklistDefaultStep[] } {
  const def = CHECKLIST_DEFAULTS.find((d) => d.key === goalKey);
  if (!def || !def.steps?.length) {
    throw new Error(`Canonical ${goalKey} goal with steps not found in CHECKLIST_DEFAULTS`);
  }
  return { def, steps: def.steps };
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
 * Plan the collapse of one goal's flat cluster for a booking, or return null when there is
 * nothing to do — already migrated (a goal row with `goalKey` exists) or no cluster present.
 * Idempotent by construction: re-running over an already-migrated booking is a no-op.
 *
 * The migrated goal always carries the full canonical step spine; each step's state is overlaid
 * from the matching old flat item by key (a missing item → a PENDING step), so a partial cluster
 * — or a step that never had a flat item (e.g. the new `send_deposit_invoice`) — still yields a
 * complete, consistent goal and never loses recorded state. The post-migration evaluate() then
 * auto-completes any such PENDING step whose predicate already holds (e.g. the deposit email was
 * already sent).
 */
export function planGoalMigration(
  items: FlatChecklistItem[],
  goalKey: string,
): GoalMigrationPlan | null {
  if (items.some((i) => i.key === goalKey)) return null;
  const { def, steps: stepDefs } = canonicalGoal(goalKey);
  const stepKeys = stepDefs.map((s) => s.key);

  const cluster = items.filter((i) => i.key != null && stepKeys.includes(i.key));
  if (cluster.length === 0) return null;

  const byKey = new Map(cluster.map((i) => [i.key as string, i]));

  const steps: PlannedStep[] = stepDefs.map((sDef, idx) => {
    const old = byKey.get(sDef.key);
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
      autoCompleteRule: sDef.autoCompleteRule ?? null,
      dueDateRule: (sDef.dueDateRule as Record<string, unknown> | null) ?? null,
    };
  });

  // Monotonic back-fill of the milestone spine: a deliverable can't have reached a later
  // milestone without traversing the earlier ones, so a COMPLETE step implies its predecessors
  // are done. This matters for a step ADDED in this release with no flat predecessor (the new
  // `send_deposit_invoice`): a booking whose deposit was already received — possibly in cash,
  // with no email record for the post-migration evaluate() to key off — must migrate to a
  // COMPLETE goal, never one nagging "Send deposit invoice" for money already in the bank
  // (Story 21). Sweep last→first; once a COMPLETE is seen, an earlier PENDING inherits COMPLETE.
  // FAILED is left untouched (a bounced send is a real, surfaced state, not a gap).
  let seenComplete = false;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].state === 'COMPLETE') seenComplete = true;
    else if (seenComplete && steps[i].state === 'PENDING') steps[i].state = 'COMPLETE';
  }

  // The goal sits where the cluster was (lowest order) and dates against the cluster's earliest
  // stored deadline (the first hard musician deadline the cluster carried — generalising #607's
  // "carry the send_contract dueDate").
  const order = Math.min(...cluster.map((i) => i.order));
  const dueDate = cluster
    .map((i) => i.dueDate)
    .filter((d): d is Date => d != null)
    .reduce<Date | null>((earliest, d) => (!earliest || d < earliest ? d : earliest), null);
  const state = rollUp(steps.map((s) => ({ state: s.state })));
  // A fully-migrated (COMPLETE) goal carries a completion timestamp like a naturally completed
  // one would — the latest step completion.
  const completedAt =
    state === 'COMPLETE'
      ? steps.reduce<Date | null>(
          (latest, s) => (s.completedAt && (!latest || s.completedAt > latest) ? s.completedAt : latest),
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

/**
 * Migrate a user's *saved* checklist template (the full list stored in
 * `preferences.checklistDefaults`) for the given goal keys. A template saved before #608 is
 * frozen with the flat cluster entries; the New Booking form seeds the intersection of this
 * template with the backend reminder preview, so until it carries the goal key a new booking
 * would drop that deliverable (the old keys are no longer preview keys). Collapsing each cluster
 * to its canonical goal entry keeps new bookings seeding the goal — AC1.
 *
 * Returns null when the template has no old cluster keys for any of the given goals (already
 * current, or empty so the system falls back to CHECKLIST_DEFAULTS, which is current). Other
 * system items keep the user's enabled/dueDateRule overrides and order; custom items are
 * preserved. (A user-level disable of an individual step is not carried — the deliverable is one
 * goal now; the goal re-seeds enabled, re-disablable.)
 */
// Map every old cluster step key → its goal's canonical entry, across all the given goals.
function stepKeyToGoalMap(goalKeys: string[]): Map<string, ChecklistDefaultItem> {
  const map = new Map<string, ChecklistDefaultItem>();
  for (const goalKey of goalKeys) {
    const { def, steps } = canonicalGoal(goalKey);
    for (const s of steps) map.set(s.key, def);
  }
  return map;
}

export function planTemplateMigration(
  storedDefaults: ChecklistDefaultItem[],
  goalKeys: string[],
): ChecklistDefaultItem[] | null {
  const stepKeyToGoal = stepKeyToGoalMap(goalKeys);

  if (!storedDefaults.some((d) => d.key != null && stepKeyToGoal.has(d.key))) {
    return null;
  }

  const result: ChecklistDefaultItem[] = [];
  const insertedGoals = new Set<string>();
  for (const item of storedDefaults) {
    const goalDef = item.key != null ? stepKeyToGoal.get(item.key) : undefined;
    if (!goalDef) {
      result.push(item);
      continue;
    }
    // Replace the first cluster member with the canonical goal entry; drop the rest.
    if (!insertedGoals.has(goalDef.key)) {
      result.push(goalDef);
      insertedGoals.add(goalDef.key);
    }
  }
  return result;
}
