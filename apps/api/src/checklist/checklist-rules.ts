import { isConcernComplete, CompletenessConcern } from '../bookings/booking-completeness';

/**
 * The auto-complete predicate vocabulary (ADR-0016 / ADR-0057). A rule is the
 * declarative condition that flips a checklist unit to COMPLETE (or FAILED). It
 * lives on an atomic Goal's `autoCompleteRule`, and — once steps exist — on a
 * milestone Step. Extracted from the evaluator so both the atomic-goal branch
 * and the per-step predicate registry share one implementation (no drift).
 */
export type AutoCompleteRule =
  | { type: 'bookingField'; field: string; operator: 'notNull' }
  | { type: 'communicationSent'; templateTypes: string[] }
  // `includeDraft` (ADR-0057 / #617): the *create* milestone is satisfied by a draft-or-beyond
  // invoice (a saved scratchpad advances the goal); the *issue* milestone leaves it falsy so a
  // DRAFT does NOT satisfy it (the #585 fix — an unissued draft keeps "Issue" surfaced). VOID is
  // excluded upstream in the context projection either way.
  | { type: 'invoiceExists'; isDeposit: boolean; includeDraft?: boolean }
  | { type: 'musicFormResponse' }
  | { type: 'contractSigned' }
  // PRECONDITION predicate (ADR-0057 / #618): the booking's customer has an email address — the
  // prerequisite for any emailing goal. `bookingField fee notNull` covers the other precondition
  // (the booking has a fee), reusing the existing rule.
  | { type: 'customerEmail' }
  | { type: 'completeness'; concern: CompletenessConcern };

/** The booking facts a rule reads. Mirrors the repository's context projection. */
export interface BookingContext {
  status: string;
  venueId: string | null;
  customerId: string | null;
  customerEmail: string | null;
  fee: string | null;
  depositReceivedAt: Date | null;
  setsCount: number;
  logistics: unknown;
  communications: Array<{ status: string; template: { builtInType: string | null } | null }>;
  invoices: Array<{ isDeposit: boolean; status: string }>;
  contracts: Array<{ status: string }>;
  musicFormResponse: { id: string } | null;
}

/** The terminal/non-terminal outcome a single rule (or step) evaluates to. */
export type RuleState = 'PENDING' | 'COMPLETE' | 'FAILED';

/**
 * The booking-context fields a rule observes. A business event that mutates one
 * of these inputs is what the event-targeted evaluator's inverted index keys on:
 * `inputs` declares exactly which events can move a step, so an event resolves to
 * the affected steps in O(1) instead of recomputing the whole checklist.
 */
export type InputKey =
  | 'communications'
  | 'invoices'
  | 'contracts'
  | 'depositReceivedAt'
  | 'musicFormResponse'
  | 'venueId'
  | 'customerId'
  | 'customerEmail'
  | 'fee'
  | 'setsCount'
  | 'logistics';

/** True when the rule's success condition holds for the given booking facts. */
export function evaluateRule(rule: AutoCompleteRule, ctx: BookingContext): boolean {
  switch (rule.type) {
    case 'bookingField':
      if (rule.field === 'depositReceivedAt') return ctx.depositReceivedAt !== null;
      if (rule.field === 'activeContract') return ctx.contracts.length > 0;
      if (rule.field === 'fee') return ctx.fee !== null; // #618 fee precondition
      return false;
    case 'communicationSent':
      return ctx.communications.some(
        (c) => c.status === 'SENT' && rule.templateTypes.includes(c.template?.builtInType ?? ''),
      );
    case 'invoiceExists':
      // The create step (includeDraft) accepts any non-VOID invoice (drafts are projected in);
      // the issue step (default) requires a non-DRAFT invoice — the #585 fix preserved.
      return ctx.invoices.some(
        (i) => i.isDeposit === rule.isDeposit && (rule.includeDraft === true || i.status !== 'DRAFT'),
      );
    case 'musicFormResponse':
      return ctx.musicFormResponse !== null;
    case 'contractSigned':
      return ctx.contracts.some((c) => c.status === 'SIGNED');
    case 'customerEmail':
      return ctx.customerEmail != null && ctx.customerEmail.trim() !== '';
    // Structural items (Module D) bind their done-state to a completeness predicate
    // (Module A), so "is this concern done?" lives in exactly one place.
    case 'completeness':
      return isConcernComplete(rule.concern, ctx);
  }
}

/**
 * A communicationSent rule fails when the *last* matching communication FAILED —
 * a send that bounced. Only communicationSent rules can reach FAILED.
 */
export function isCommFailed(rule: AutoCompleteRule, ctx: BookingContext): boolean {
  if (rule.type !== 'communicationSent') return false;
  const matching = ctx.communications.filter((c) =>
    rule.templateTypes.includes(c.template?.builtInType ?? ''),
  );
  return matching.length > 0 && matching[matching.length - 1].status === 'FAILED';
}

/**
 * The non-sticky outcome of a rule: COMPLETE if its condition holds, FAILED if a
 * matching send bounced, else PENDING. Stickiness (never leaving COMPLETE/SKIPPED)
 * is the caller's concern — this is a pure function of the rule and the facts.
 */
export function evaluateRuleState(rule: AutoCompleteRule, ctx: BookingContext): RuleState {
  if (evaluateRule(rule, ctx)) return 'COMPLETE';
  if (isCommFailed(rule, ctx)) return 'FAILED';
  return 'PENDING';
}

/** The booking-context fields this rule reads — its entry in the inverted index. */
export function inputsForRule(rule: AutoCompleteRule): InputKey[] {
  switch (rule.type) {
    case 'bookingField':
      if (rule.field === 'depositReceivedAt') return ['depositReceivedAt'];
      if (rule.field === 'fee') return ['fee'];
      return ['contracts'];
    case 'communicationSent':
      return ['communications'];
    case 'invoiceExists':
      return ['invoices'];
    case 'musicFormResponse':
      return ['musicFormResponse'];
    case 'contractSigned':
      return ['contracts'];
    case 'customerEmail':
      return ['customerEmail'];
    case 'completeness':
      if (rule.concern === 'venue') return ['venueId'];
      if (rule.concern === 'people') return ['customerId'];
      return ['setsCount', 'logistics']; // itinerary
  }
}
