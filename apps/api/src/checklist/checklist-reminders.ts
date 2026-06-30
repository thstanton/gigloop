// Module 2 — the applicable-reminders selector (pure; ADR-0052, PRD #538).
//
// Given a concern, the booking's checklist items, the booking's current status,
// and the user's globally-disabled system keys, returns the ordered list the
// per-concern "Remind me about" control renders. No DB access.
//
// The control's job is discovery + opt-out: it shows every reminder the booking
// has *not yet passed the stage for*, whether or not it has been seeded. So the
// output includes system reminders with no booking record yet (discoverable,
// on-demand seedable) alongside the ones already tracked or opted out.

import { CHECKLIST_DEFAULTS } from '../bookings/checklist-defaults';
import { concernForKey, keysForConcern, ReminderConcern } from './checklist-concerns';
import { isPastStage } from './checklist-surfacing';
import { isDepSatisfied } from './checklist-evaluator.service';

// The booking checklist item fields the selector reads.
export interface ReminderItemInput {
  id: string;
  key: string | null;
  state: string;
  requiredForStatus: string | null;
  concern: string | null;
  label: string;
  order: number;
}

export interface ApplicableReminder {
  // The existing booking item, or null for a discoverable system reminder with no
  // record yet (turning it on triggers an on-demand seed).
  itemId: string | null;
  key: string | null;
  label: string;
  // Tracked (anything but SKIPPED) reads as on; SKIPPED or not-yet-seeded reads as off.
  on: boolean;
  source: 'system' | 'custom';
  // Lifecycle state of the existing item, or null when not yet seeded. Lets the
  // control show COMPLETE/BLOCKED/FAILED *within* the "on" state.
  state: string | null;
  requiredForStatus: string | null;
  // The auto-complete *condition* (the "when …" tail) for reminders whose resolution isn't obvious
  // from the label — the client-committed milestones (#567). Null for the self-evident Send/Create
  // items and the manual ones. The control renders it after a tick icon: "✓ when the client signs".
  autoCompleteHint: string | null;
  // The dependency clause (#557/#558), rendered as ", after you <after>". Present only while an
  // unmet prerequisite is a *live gate* — outstanding (PENDING/BLOCKED/FAILED) and tracked, matching
  // the #554 blocking predicate. Null once the prereq is COMPLETE/SKIPPED/absent (nothing to wait for).
  after: string | null;
}

export interface SelectorContext {
  items: ReminderItemInput[];
  status: string;
  disabledKeys: Set<string>;
}

// Template (workflow) position of a system key — the canonical display order.
const TEMPLATE_INDEX: Record<string, number> = Object.fromEntries(
  CHECKLIST_DEFAULTS.map((d, idx) => [d.key, idx] as const),
);

// The auto-complete condition surfaced in the control (#567), keyed by autoCompleteRule.type. Only
// the *non-obvious* resolvers — the client-committed milestones — get a hint; the self-evident
// Send/Create items and the manual ones (no rule) return null. The phrase is the "when …" tail, so
// it reads "✓ when the client signs in the portal" after the control's tick icon.
const AUTO_COMPLETE_HINTS: Record<string, string> = {
  contractSigned: 'when the client signs in the portal',
  musicFormResponse: 'when the client sends their requests',
};

function autoCompleteHintFor(rule: Record<string, unknown> | null): string | null {
  const type = typeof rule?.type === 'string' ? rule.type : null;
  return type ? AUTO_COMPLETE_HINTS[type] ?? null : null;
}

// The action phrase for a *prerequisite* key, used in the "after you <phrase>" dependency clause
// (#557/#558). Keyed by the prereq's key (not the dependent's). Every key that appears in any
// default's `dependsOn` must have an entry — guarded by a test so a new dependency can't silently
// drop its clause.
// ADR-0057 / #607–#608: the contract, deposit, balance and song-request deliverables are now
// multi-step goals — their old flat steps (create_contract, send_contract, create_balance_invoice,
// music_form_invite, …) are intrinsically ordered within their goal and no longer appear in any
// goal's `dependsOn`, so their prerequisite phrases retire. What remains is the cross-goal deal
// spine: confirm_quote ← send_quote and send_thank_you ← play_the_gig.
export const PREREQUISITE_PHRASES: Record<string, string> = {
  send_quote: 'send the quote',
  play_the_gig: 'play the gig',
};

// The dependency clause for a reminder: the phrases of its unmet prerequisites, joined with "and".
// "Unmet" mirrors the #554 blocking predicate exactly (reusing isDepSatisfied) — a prereq gates only
// while outstanding (PENDING/BLOCKED/FAILED) and tracked; COMPLETE/SKIPPED/absent never gate.
function afterClauseFor(dependsOn: string[], stateMap: Map<string, string>): string | null {
  const phrases = dependsOn
    .filter((depKey) => !isDepSatisfied(depKey, stateMap))
    .map((depKey) => PREREQUISITE_PHRASES[depKey])
    .filter((phrase): phrase is string => Boolean(phrase));
  if (phrases.length === 0) return null;
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
}

function systemReminders(concern: ReminderConcern, ctx: SelectorContext): ApplicableReminder[] {
  const byKey = new Map(ctx.items.filter((i) => i.key).map((i) => [i.key as string, i]));
  // key→state for the dependency live-gate check (absent keys read as satisfied, per #554).
  const stateMap = new Map(ctx.items.filter((i) => i.key).map((i) => [i.key as string, i.state]));

  return keysForConcern(concern)
    .map((key) => CHECKLIST_DEFAULTS.find((d) => d.key === key))
    .filter((d): d is (typeof CHECKLIST_DEFAULTS)[number] => d !== undefined)
    // Global master switch: a key disabled in Settings is never offered.
    .filter((d) => !ctx.disabledKeys.has(d.key))
    // Stage gate: only current-or-future reminders (past ones were system-retired).
    .filter((d) => !isPastStage(ctx.status, d.requiredForStatus))
    .map((d) => {
      const item = byKey.get(d.key);
      return {
        itemId: item?.id ?? null,
        key: d.key,
        label: d.label,
        on: item ? item.state !== 'SKIPPED' : false,
        source: 'system' as const,
        state: item?.state ?? null,
        requiredForStatus: d.requiredForStatus,
        autoCompleteHint: autoCompleteHintFor(d.autoCompleteRule),
        after: afterClauseFor(d.dependsOn, stateMap),
      };
    })
    .sort((a, b) => (TEMPLATE_INDEX[a.key as string] ?? 0) - (TEMPLATE_INDEX[b.key as string] ?? 0));
}

function customReminders(concern: ReminderConcern, ctx: SelectorContext): ApplicableReminder[] {
  return ctx.items
    // Custom = no key; concern-less customs are excluded from every concern.
    .filter((i) => !i.key && i.concern === concern)
    // Same stage gate as system items (a custom may carry a requiredForStatus).
    .filter((i) => !isPastStage(ctx.status, i.requiredForStatus))
    .sort((a, b) => a.order - b.order)
    .map((i) => ({
      itemId: i.id,
      key: null,
      label: i.label,
      on: i.state !== 'SKIPPED',
      source: 'custom' as const,
      state: i.state,
      requiredForStatus: i.requiredForStatus,
      // Custom items carry no autoCompleteRule in the selector input, so never a hint.
      autoCompleteHint: null,
      // Custom items carry no dependsOn in the selector input, so never a dependency clause.
      after: null,
    }));
}

/**
 * The ordered reminders to render in a concern's "Remind me about" control:
 * system reminders in template (workflow) order, then concern-tagged custom items.
 */
export function selectApplicableReminders(
  concern: ReminderConcern,
  ctx: SelectorContext,
): ApplicableReminder[] {
  return [...systemReminders(concern, ctx), ...customReminders(concern, ctx)];
}

// ───────────────────────────────────────────────────────────────────────────
// Preview (pre-creation) — the New Booking form (#560).
//
// Before a booking exists there is no checklist to seed against (atomic create,
// ADR-0047), so the create form can't use selectApplicableReminders (which keys
// off real booking items). Instead it previews the *system* reminders a booking
// started at `status` would offer, grouped by concern, so the create surface
// matches the Builder without the frontend re-deriving the concern map, the
// auto-complete hints, or the prerequisite phrases.
//
// Pre-creation is "selection-as-state": every previewed reminder defaults on
// (will be seeded) and the user toggles to exclude. The "after you …" clause is
// recomputed on the frontend from the live selection, so the preview does not
// resolve `after` itself — it returns each row's in-scope prerequisites as
// { key, phrase } pairs and the frontend gates them by what's currently selected.

export interface ReminderPrerequisite {
  // The prerequisite system key (e.g. 'create_contract').
  key: string;
  // Its action phrase for the "after you <phrase>" clause (e.g. 'create the contract').
  phrase: string;
}

export interface ReminderPreview {
  key: string;
  label: string;
  concern: ReminderConcern;
  requiredForStatus: string | null;
  autoCompleteHint: string | null;
  // In-scope prerequisites (see PreviewContext) with their phrases; the frontend shows the clause
  // only while a prerequisite is itself still selected. Empty when the row has no live prerequisite.
  prerequisites: ReminderPrerequisite[];
}

export interface PreviewContext {
  // The booking's starting status — drives the same past-stage filter as the Builder.
  status: string;
  // System keys disabled in the user's template (enabled === false) — never offered, matching the
  // Builder's master switch.
  disabledKeys: Set<string>;
}

/**
 * The system reminders the New Booking form previews for a booking starting at `status`, in
 * template (workflow) order with their concern. Mirrors the Builder's system-reminder set: same
 * past-stage filter, same disabled-key master switch, same labels/hints from the global catalog
 * (the user's template customises only the enabled flags, exactly as the Builder reads them).
 *
 * Prerequisite scope is the *global, stage-filtered* set of in-scope keys — a dependency that spans
 * concerns (send_contract → create_contract) is preserved, and a prerequisite that has itself been
 * filtered out as past-stage never appears in a dependent's clause.
 */
export function previewApplicableReminders(ctx: PreviewContext): ReminderPreview[] {
  const inScope = CHECKLIST_DEFAULTS.filter(
    (d) => !ctx.disabledKeys.has(d.key) && !isPastStage(ctx.status, d.requiredForStatus),
  );
  const inScopeKeys = new Set(inScope.map((d) => d.key));

  return inScope.flatMap((d) => {
    const concern = concernForKey(d.key);
    // Every catalogued key maps to a concern (guarded by checklist-concerns tests); skip defensively.
    if (!concern) return [];
    return [
      {
        key: d.key,
        label: d.label,
        concern,
        requiredForStatus: d.requiredForStatus,
        autoCompleteHint: autoCompleteHintFor(d.autoCompleteRule),
        prerequisites: d.dependsOn
          .filter((dep) => inScopeKeys.has(dep) && PREREQUISITE_PHRASES[dep])
          .map((dep) => ({ key: dep, phrase: PREREQUISITE_PHRASES[dep] })),
      },
    ];
  });
}

// Re-exported for callers that resolve a system item's concern (e.g. building the
// selector response for an item that carries a key).
export { concernForKey };
