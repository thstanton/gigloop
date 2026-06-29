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
  | { type: 'invoiceExists'; isDeposit: boolean }
  | { type: 'musicFormResponse' }
  | { type: 'contractSigned' }
  | { type: 'completeness'; concern: CompletenessConcern };

/** The booking facts a rule reads. Mirrors the repository's context projection. */
export interface BookingContext {
  status: string;
  venueId: string | null;
  customerId: string | null;
  depositReceivedAt: Date | null;
  setsCount: number;
  logistics: unknown;
  communications: Array<{ status: string; template: { builtInType: string | null } | null }>;
  invoices: Array<{ isDeposit: boolean }>;
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
  | 'setsCount'
  | 'logistics';

/** True when the rule's success condition holds for the given booking facts. */
export function evaluateRule(rule: AutoCompleteRule, ctx: BookingContext): boolean {
  switch (rule.type) {
    case 'bookingField':
      if (rule.field === 'depositReceivedAt') return ctx.depositReceivedAt !== null;
      if (rule.field === 'activeContract') return ctx.contracts.length > 0;
      return false;
    case 'communicationSent':
      return ctx.communications.some(
        (c) => c.status === 'SENT' && rule.templateTypes.includes(c.template?.builtInType ?? ''),
      );
    case 'invoiceExists':
      return ctx.invoices.some((i) => i.isDeposit === rule.isDeposit);
    case 'musicFormResponse':
      return ctx.musicFormResponse !== null;
    case 'contractSigned':
      return ctx.contracts.some((c) => c.status === 'SIGNED');
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
      return rule.field === 'depositReceivedAt' ? ['depositReceivedAt'] : ['contracts'];
    case 'communicationSent':
      return ['communications'];
    case 'invoiceExists':
      return ['invoices'];
    case 'musicFormResponse':
      return ['musicFormResponse'];
    case 'contractSigned':
      return ['contracts'];
    case 'completeness':
      if (rule.concern === 'venue') return ['venueId'];
      if (rule.concern === 'people') return ['customerId'];
      return ['setsCount', 'logistics']; // itinerary
  }
}
