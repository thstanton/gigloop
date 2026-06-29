import { CHECKLIST_DEFAULTS } from '../bookings/checklist-defaults';
import {
  AutoCompleteRule,
  BookingContext,
  InputKey,
  RuleState,
  evaluateRuleState,
  inputsForRule,
} from './checklist-rules';

/**
 * What a step *is* (ADR-0057). A MILESTONE advances the deliverable (create →
 * issue → send) and is the spine the progress measure counts; PRECONDITION /
 * FOLLOWUP arrive in later increments. v1 registers MILESTONE keys only.
 */
export type StepKind = 'MILESTONE' | 'PRECONDITION' | 'FOLLOWUP';

/**
 * *How* a step reaches COMPLETE — by the musician acting now (ACTION) or by
 * awaiting an external event (AWAITED). Orthogonal to who acts: `deposit_received`
 * is awaited even though a USER records it; `contract_signed` / `song_requests`
 * await the client.
 */
export type CompleteMode = 'ACTION' | 'AWAITED';

export interface PredicateEntry {
  /** The non-sticky outcome of this key's rule against a booking's facts. */
  predicate: (ctx: BookingContext) => RuleState;
  /** The booking-context fields the predicate reads — drives the inverted index. */
  inputs: InputKey[];
  kind: StepKind;
  completeMode: CompleteMode;
  /** The underlying rule, retained for inspection/migration onto step rows. */
  rule: AutoCompleteRule;
}

/**
 * Keys that reach COMPLETE by awaiting an external event rather than a musician
 * action now. The discriminator is the event source, not `completedBy`:
 *   - contractSigned / musicFormResponse — the client acts in the portal
 *   - depositReceivedAt — an external payment lands (the USER only records it)
 * Everything else (creates, sends, structural completeness) is ACTION.
 */
function completeModeForRule(rule: AutoCompleteRule): CompleteMode {
  if (rule.type === 'contractSigned' || rule.type === 'musicFormResponse') return 'AWAITED';
  if (rule.type === 'bookingField' && rule.field === 'depositReceivedAt') return 'AWAITED';
  return 'ACTION';
}

/**
 * The static predicate catalog (ADR-0057): `stepKey → { predicate, inputs, kind,
 * completeMode }`. Built from the system template's auto-completing keys, so the
 * catalog and the seeded rules can never disagree. This splits the *shared static
 * catalog* (here) from *per-booking step instances* (materialised state on rows)
 * and *per-user defaults* (which goals are selected). v1 entries are all MILESTONE.
 *
 * Manual keys (no autoCompleteRule — `confirm_quote`, `play_the_gig`) have no
 * predicate and are absent: they are atomic goals the musician ticks by hand.
 */
export const STEP_PREDICATES: Record<string, PredicateEntry> = Object.fromEntries(
  CHECKLIST_DEFAULTS.filter((d) => d.autoCompleteRule != null).map((d) => {
    const rule = d.autoCompleteRule as unknown as AutoCompleteRule;
    return [
      d.key,
      {
        predicate: (ctx: BookingContext) => evaluateRuleState(rule, ctx),
        inputs: inputsForRule(rule),
        kind: 'MILESTONE' as const,
        completeMode: completeModeForRule(rule),
        rule,
      } satisfies PredicateEntry,
    ];
  }),
);

/**
 * Inverted index `InputKey → Set<stepKey>`: the steps a change to that input can
 * move. The event-targeted evaluator resolves a business event's changed inputs
 * to exactly the affected keys, instead of recomputing every key (ADR-0057's
 * containment story; folds the parked audit-H1 evaluator redesign).
 */
const INVERTED_INDEX: Map<InputKey, Set<string>> = (() => {
  const index = new Map<InputKey, Set<string>>();
  for (const [key, entry] of Object.entries(STEP_PREDICATES)) {
    for (const input of entry.inputs) {
      const bucket = index.get(input) ?? new Set<string>();
      bucket.add(key);
      index.set(input, bucket);
    }
  }
  return index;
})();

/** The keys whose predicate observes any of the given changed inputs. */
export function affectedKeys(changedInputs: ReadonlyArray<InputKey>): Set<string> {
  const keys = new Set<string>();
  for (const input of changedInputs) {
    for (const key of INVERTED_INDEX.get(input) ?? []) keys.add(key);
  }
  return keys;
}
