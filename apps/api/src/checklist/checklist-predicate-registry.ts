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

/** Build one catalog entry from a rule, with an explicit kind/completeMode override
 *  (a step supplies its own; an atomic goal derives completeMode from the rule). */
function entryForRule(
  rule: AutoCompleteRule,
  kind: StepKind,
  completeMode: CompleteMode,
): PredicateEntry {
  return {
    predicate: (ctx: BookingContext) => evaluateRuleState(rule, ctx),
    inputs: inputsForRule(rule),
    kind,
    completeMode,
    rule,
  } satisfies PredicateEntry;
}

/**
 * The static predicate catalog (ADR-0057): `key → { predicate, inputs, kind,
 * completeMode }`. Built from the system template's auto-completing keys, so the
 * catalog and the seeded rules can never disagree. This splits the *shared static
 * catalog* (here) from *per-booking step instances* (materialised state on rows)
 * and *per-user defaults* (which goals are selected).
 *
 * A multi-step goal contributes one entry per step (keyed by the step's unique
 * template key, with the step's own kind/completeMode); an atomic goal contributes
 * one entry under its own key. The goal row of a multi-step goal carries no rule and
 * so is absent — its state is the roll-up of its steps. Manual keys (no rule —
 * `confirm_quote`, `play_the_gig`) are likewise absent: the musician ticks them.
 *
 * Step keys must be globally unique across all goals (a flat record cannot hold two
 * `create` keys) — hence steps reuse the unique flat-template keys (`create_contract`,
 * `send_contract`, …), never bare verbs.
 */
export const STEP_PREDICATES: Record<string, PredicateEntry> = Object.fromEntries(
  CHECKLIST_DEFAULTS.flatMap((d) => {
    if (d.steps && d.steps.length > 0) {
      return d.steps
        .filter((s) => s.autoCompleteRule != null)
        .map((s) => {
          const rule = s.autoCompleteRule as unknown as AutoCompleteRule;
          return [s.key, entryForRule(rule, s.kind, s.completeMode)] as const;
        });
    }
    if (d.autoCompleteRule != null) {
      const rule = d.autoCompleteRule as unknown as AutoCompleteRule;
      return [[d.key, entryForRule(rule, 'MILESTONE', completeModeForRule(rule))] as const];
    }
    return [];
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
