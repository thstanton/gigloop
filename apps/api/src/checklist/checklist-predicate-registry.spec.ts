import { STEP_PREDICATES, affectedKeys } from './checklist-predicate-registry';
import { BookingContext } from './checklist-rules';

function makeCtx(overrides: Partial<BookingContext> = {}): BookingContext {
  return {
    status: 'ENQUIRY',
    venueId: null,
    customerId: null,
    customerEmail: null,
    fee: null,
    depositReceivedAt: null,
    setsCount: 0,
    logistics: null,
    communications: [],
    invoices: [],
    contracts: [],
    musicFormResponse: null,
    musicFormPublished: false,
    ...overrides,
  };
}

describe('STEP_PREDICATES catalog', () => {
  it('registers every auto-completing system key and omits manual ones', () => {
    // Auto-completing keys present:
    expect(STEP_PREDICATES.send_quote).toBeDefined();
    expect(STEP_PREDICATES.create_deposit_invoice).toBeDefined();
    expect(STEP_PREDICATES.issue_deposit_invoice).toBeDefined(); // #617: the new issue milestone
    expect(STEP_PREDICATES.contract_signed).toBeDefined();
    expect(STEP_PREDICATES.set_up_and_publish).toBeDefined(); // #533/#630: the music publish milestone
    // Manual keys (no autoCompleteRule) absent:
    expect(STEP_PREDICATES.confirm_quote).toBeUndefined();
    expect(STEP_PREDICATES.play_the_gig).toBeUndefined();
  });

  it('registers MILESTONE and PRECONDITION steps; no FOLLOWUP yet (ADR-0057 / #618)', () => {
    const kinds = new Set(Object.values(STEP_PREDICATES).map((e) => e.kind));
    expect(kinds).toEqual(new Set(['MILESTONE', 'PRECONDITION']));
    // The fee/email preconditions register with kind PRECONDITION.
    expect(STEP_PREDICATES.set_fee_deposit.kind).toBe('PRECONDITION');
    expect(STEP_PREDICATES.add_email_quote.kind).toBe('PRECONDITION');
  });

  it('classifies completeMode by event source, independent of completedBy', () => {
    // AWAITED — reached by an external/client event, not a musician action now:
    expect(STEP_PREDICATES.contract_signed.completeMode).toBe('AWAITED');
    expect(STEP_PREDICATES.song_requests.completeMode).toBe('AWAITED');
    expect(STEP_PREDICATES.deposit_received.completeMode).toBe('AWAITED'); // USER records, but awaited
    // ACTION — the musician acts now:
    expect(STEP_PREDICATES.send_quote.completeMode).toBe('ACTION');
    expect(STEP_PREDICATES.create_deposit_invoice.completeMode).toBe('ACTION');
    expect(STEP_PREDICATES.issue_deposit_invoice.completeMode).toBe('ACTION');
    expect(STEP_PREDICATES.add_venue.completeMode).toBe('ACTION');
    expect(STEP_PREDICATES.set_up_and_publish.completeMode).toBe('ACTION'); // #533/#630: musician publishes now
  });

  it('registers set_up_and_publish as a MILESTONE reading musicFormPublished (#533/#630)', () => {
    expect(STEP_PREDICATES.set_up_and_publish.kind).toBe('MILESTONE');
    expect(STEP_PREDICATES.set_up_and_publish.inputs).toEqual(['musicFormPublished']);
  });

  it('declares the exact inputs each predicate reads', () => {
    expect(STEP_PREDICATES.send_quote.inputs).toEqual(['communications']);
    expect(STEP_PREDICATES.create_deposit_invoice.inputs).toEqual(['invoices']);
    expect(STEP_PREDICATES.issue_deposit_invoice.inputs).toEqual(['invoices']);
    expect(STEP_PREDICATES.deposit_received.inputs).toEqual(['depositReceivedAt']);
    expect(STEP_PREDICATES.create_contract.inputs).toEqual(['contracts']); // bookingField activeContract
    expect(STEP_PREDICATES.contract_signed.inputs).toEqual(['contracts']);
    expect(STEP_PREDICATES.song_requests.inputs).toEqual(['musicFormResponse']);
    expect(STEP_PREDICATES.add_venue.inputs).toEqual(['venueId']);
    expect(STEP_PREDICATES.build_itinerary.inputs).toEqual(['setsCount', 'logistics']);
  });
});

describe('predicates fire on their declared input and not otherwise', () => {
  it('send_quote completes only on a SENT matching communication', () => {
    expect(STEP_PREDICATES.send_quote.predicate(makeCtx())).toBe('PENDING');
    // A change to an undeclared input (venueId) does not move it:
    expect(STEP_PREDICATES.send_quote.predicate(makeCtx({ venueId: 'v1' }))).toBe('PENDING');
    // Its declared input does:
    expect(
      STEP_PREDICATES.send_quote.predicate(
        makeCtx({ communications: [{ status: 'SENT', template: { builtInType: 'quote' } }] }),
      ),
    ).toBe('COMPLETE');
  });

  it('send_quote fails when its last matching communication bounced', () => {
    expect(
      STEP_PREDICATES.send_quote.predicate(
        makeCtx({ communications: [{ status: 'FAILED', template: { builtInType: 'quote' } }] }),
      ),
    ).toBe('FAILED');
  });

  it('create_deposit_invoice (includeDraft) completes on a draft-or-beyond deposit invoice', () => {
    expect(STEP_PREDICATES.create_deposit_invoice.predicate(makeCtx({ invoices: [{ isDeposit: false, status: 'ISSUED' }] }))).toBe('PENDING');
    // #617: a saved DRAFT advances the create step.
    expect(STEP_PREDICATES.create_deposit_invoice.predicate(makeCtx({ invoices: [{ isDeposit: true, status: 'DRAFT' }] }))).toBe('COMPLETE');
    expect(STEP_PREDICATES.create_deposit_invoice.predicate(makeCtx({ invoices: [{ isDeposit: true, status: 'ISSUED' }] }))).toBe('COMPLETE');
  });

  it('issue_deposit_invoice excludes a DRAFT (the #585 fix) but fires on a non-draft deposit', () => {
    // A created-but-unissued draft must keep "Issue the invoice" surfaced.
    expect(STEP_PREDICATES.issue_deposit_invoice.predicate(makeCtx({ invoices: [{ isDeposit: true, status: 'DRAFT' }] }))).toBe('PENDING');
    expect(STEP_PREDICATES.issue_deposit_invoice.predicate(makeCtx({ invoices: [{ isDeposit: true, status: 'ISSUED' }] }))).toBe('COMPLETE');
  });

  it('set_up_and_publish completes only when the music form is published, and reverts otherwise (#533/#630)', () => {
    // Draft (on but not published) → still PENDING; un-publishing reverts it here too.
    expect(STEP_PREDICATES.set_up_and_publish.predicate(makeCtx({ musicFormPublished: false }))).toBe('PENDING');
    // An undeclared input (venueId) does not move it.
    expect(STEP_PREDICATES.set_up_and_publish.predicate(makeCtx({ venueId: 'v1' }))).toBe('PENDING');
    // Its declared input does.
    expect(STEP_PREDICATES.set_up_and_publish.predicate(makeCtx({ musicFormPublished: true }))).toBe('COMPLETE');
  });

  it('deposit_received completes only when depositReceivedAt is set', () => {
    expect(STEP_PREDICATES.deposit_received.predicate(makeCtx())).toBe('PENDING');
    expect(STEP_PREDICATES.deposit_received.predicate(makeCtx({ depositReceivedAt: new Date() }))).toBe('COMPLETE');
  });

  it('contract_signed completes only on a SIGNED contract, not a DRAFT one', () => {
    expect(STEP_PREDICATES.contract_signed.predicate(makeCtx({ contracts: [{ status: 'DRAFT' }] }))).toBe('PENDING');
    expect(STEP_PREDICATES.contract_signed.predicate(makeCtx({ contracts: [{ status: 'SIGNED' }] }))).toBe('COMPLETE');
  });

  it('add_venue completes only when venueId is set', () => {
    expect(STEP_PREDICATES.add_venue.predicate(makeCtx())).toBe('PENDING');
    expect(STEP_PREDICATES.add_venue.predicate(makeCtx({ venueId: 'v1' }))).toBe('COMPLETE');
  });

  it('the email precondition fires only when the customer has a (non-blank) email (#618)', () => {
    expect(STEP_PREDICATES.add_email_quote.predicate(makeCtx())).toBe('PENDING');
    expect(STEP_PREDICATES.add_email_quote.predicate(makeCtx({ customerEmail: '  ' }))).toBe('PENDING');
    expect(STEP_PREDICATES.add_email_quote.predicate(makeCtx({ customerEmail: 'a@b.com' }))).toBe('COMPLETE');
    // A change to an undeclared input (fee) does not move it.
    expect(STEP_PREDICATES.add_email_quote.predicate(makeCtx({ fee: '500' }))).toBe('PENDING');
    expect(STEP_PREDICATES.add_email_quote.inputs).toEqual(['customerEmail']);
  });

  it('the fee precondition fires only when the booking has a fee (#618)', () => {
    expect(STEP_PREDICATES.set_fee_deposit.predicate(makeCtx())).toBe('PENDING');
    expect(STEP_PREDICATES.set_fee_deposit.predicate(makeCtx({ fee: '500' }))).toBe('COMPLETE');
    // A change to an undeclared input (customerEmail) does not move it.
    expect(STEP_PREDICATES.set_fee_deposit.predicate(makeCtx({ customerEmail: 'a@b.com' }))).toBe('PENDING');
    expect(STEP_PREDICATES.set_fee_deposit.inputs).toEqual(['fee']);
  });
});

describe('affectedKeys (inverted index)', () => {
  it('maps an input to exactly the keys that observe it', () => {
    const invoiceKeys = affectedKeys(['invoices']);
    expect(invoiceKeys.has('create_deposit_invoice')).toBe(true);
    expect(invoiceKeys.has('issue_deposit_invoice')).toBe(true);
    expect(invoiceKeys.has('create_balance_invoice')).toBe(true);
    expect(invoiceKeys.has('issue_balance_invoice')).toBe(true);
    expect(invoiceKeys.has('add_venue')).toBe(false);
  });

  it('maps contracts to both the activeContract and signed predicates', () => {
    const keys = affectedKeys(['contracts']);
    expect(keys.has('create_contract')).toBe(true);
    expect(keys.has('contract_signed')).toBe(true);
  });

  it('maps depositReceivedAt to deposit_received alone', () => {
    expect([...affectedKeys(['depositReceivedAt'])]).toEqual(['deposit_received']);
  });

  it('unions the keys across several changed inputs', () => {
    const keys = affectedKeys(['venueId', 'musicFormResponse']);
    expect(keys.has('add_venue')).toBe(true);
    expect(keys.has('song_requests')).toBe(true);
  });

  it('returns an empty set for an input nothing observes once removed', () => {
    expect(affectedKeys([]).size).toBe(0);
  });
});
