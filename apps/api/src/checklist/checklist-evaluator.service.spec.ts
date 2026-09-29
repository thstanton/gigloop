import { ChecklistEvaluatorService } from './checklist-evaluator.service';
import { ChecklistRepository } from './checklist.repository';

type MockRepo = {
  findItemsWithContext: jest.Mock;
  applyStateUpdates: jest.Mock;
  findBandChecklistStepSyncData: jest.Mock;
  applyBandMemberStepSyncPlan: jest.Mock;
  findBandGoalResetData: jest.Mock;
  applyBandGoalResetPlan: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findItemsWithContext: jest.fn(),
    applyStateUpdates: jest.fn().mockResolvedValue(undefined),
    findBandChecklistStepSyncData: jest.fn().mockResolvedValue(null),
    applyBandMemberStepSyncPlan: jest.fn().mockResolvedValue(undefined),
    findBandGoalResetData: jest.fn().mockResolvedValue(null),
    applyBandGoalResetPlan: jest.fn().mockResolvedValue(undefined),
  };
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    userId: 'u1',
    status: 'ENQUIRY',
    venueId: null,
    customerId: 'cust-1',
    seriesId: null,
    setsCount: 0,
    logistics: null,
    communications: [],
    invoices: [],
    contracts: [],
    musicFormResponse: null,
    musicFormPublished: false,
    bandMembers: [],
    bandChairs: [],
    ...overrides,
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ci1',
    key: 'send_quote',
    state: 'PENDING',
    dependsOn: [] as string[],
    autoCompleteRule: null as Record<string, unknown> | null,
    completedAt: null as Date | null,
    ...overrides,
  };
}

describe('ChecklistEvaluatorService', () => {
  let service: ChecklistEvaluatorService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new ChecklistEvaluatorService(repo as unknown as ChecklistRepository);
  });

  it('does nothing when booking not found', async () => {
    repo.findItemsWithContext.mockResolvedValue({ items: [], booking: null });
    await service.evaluate('b1');
    expect(repo.applyStateUpdates).not.toHaveBeenCalled();
  });

  it('does nothing when no items', async () => {
    repo.findItemsWithContext.mockResolvedValue({ items: [], booking: makeBooking() });
    await service.evaluate('b1');
    expect(repo.applyStateUpdates).not.toHaveBeenCalled();
  });

  describe('communicationSent rule', () => {
    it('transitions PENDING → COMPLETE when matching SENT communication exists', async () => {
      const item = makeItem({
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['quote'] },
      });
      const booking = makeBooking({
        communications: [{ status: 'SENT', template: { builtInType: 'quote' } }],
      });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ], []);
    });

    it('transitions PENDING → FAILED when last matching communication FAILED', async () => {
      const item = makeItem({
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['quote'] },
      });
      const booking = makeBooking({
        communications: [{ status: 'FAILED', template: { builtInType: 'quote' } }],
      });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'FAILED' }),
      ], []);
    });

    it('transitions FAILED → COMPLETE when retry succeeds (SENT after FAILED)', async () => {
      const item = makeItem({
        state: 'FAILED',
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['quote'] },
      });
      const booking = makeBooking({
        communications: [
          { status: 'FAILED', template: { builtInType: 'quote' } },
          { status: 'SENT', template: { builtInType: 'quote' } },
        ],
      });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ], []);
    });

    it('does not match communication of different template type', async () => {
      const item = makeItem({
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['quote'] },
      });
      const booking = makeBooking({
        communications: [{ status: 'SENT', template: { builtInType: 'thank_you' } }],
      });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });
  });

  describe('completeness rule (Module A binding — add_venue)', () => {
    const addVenueItem = (overrides: Record<string, unknown> = {}) =>
      makeItem({
        id: 'ci-venue',
        key: 'add_venue',
        autoCompleteRule: { type: 'completeness', concern: 'venue' },
        ...overrides,
      });

    it('transitions PENDING → COMPLETE when venueId is set', async () => {
      const item = addVenueItem();
      const booking = makeBooking({ venueId: 'venue-1' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci-venue', state: 'COMPLETE' }),
      ], []);
    });

    it('stays PENDING when venueId is unset', async () => {
      const item = addVenueItem();
      const booking = makeBooking({ venueId: null });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('does not regress an already-COMPLETE item when venueId is later cleared', async () => {
      // Matches existing evaluator semantics: COMPLETE items are not re-evaluated, so
      // clearing the venue does not bounce add_venue back to PENDING.
      const item = addVenueItem({ state: 'COMPLETE', completedAt: new Date() });
      const booking = makeBooking({ venueId: null });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });
  });

  describe('completeness rule — build_itinerary (itinerary concern)', () => {
    const buildItineraryItem = (overrides: Record<string, unknown> = {}) =>
      makeItem({
        id: 'ci-itinerary',
        key: 'build_itinerary',
        autoCompleteRule: { type: 'completeness', concern: 'itinerary' },
        ...overrides,
      });

    it('transitions PENDING → COMPLETE when sets exist (partial state)', async () => {
      const item = buildItineraryItem();
      const booking = makeBooking({ setsCount: 1 });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci-itinerary', state: 'COMPLETE' }),
      ], []);
    });

    it('transitions PENDING → COMPLETE when sets + all time anchors exist (set state)', async () => {
      const item = buildItineraryItem();
      const logistics = {
        arrivalTime: { value: '14:00', shareWithBand: true, shareWithClient: false },
        soundCheckTime: { value: '15:00', shareWithBand: false, shareWithClient: false },
        finishTime: { value: '22:00', shareWithBand: true, shareWithClient: true },
      };
      const booking = makeBooking({ setsCount: 2, logistics });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci-itinerary', state: 'COMPLETE' }),
      ], []);
    });

    it('stays PENDING when no sets exist', async () => {
      const item = buildItineraryItem();
      const booking = makeBooking({ setsCount: 0 });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('does not regress an already-COMPLETE item when sets are later removed (sticky COMPLETE)', async () => {
      const item = buildItineraryItem({ state: 'COMPLETE', completedAt: new Date() });
      const booking = makeBooking({ setsCount: 0 });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });
  });

  describe('invoiceExists rule', () => {
    it('transitions PENDING → COMPLETE when deposit invoice exists', async () => {
      const item = makeItem({
        key: 'create_deposit_invoice',
        autoCompleteRule: { type: 'invoiceExists', isDeposit: true },
      });
      const booking = makeBooking({ invoices: [{ isDeposit: true }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ], []);
    });

    it('does not match when only balance invoice exists for deposit rule', async () => {
      const item = makeItem({
        key: 'create_deposit_invoice',
        autoCompleteRule: { type: 'invoiceExists', isDeposit: true },
      });
      const booking = makeBooking({ invoices: [{ isDeposit: false }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });
  });

  describe('bookingField rule', () => {
    it('transitions PENDING → COMPLETE when the deposit invoice is PAID (TIM-47 invoicePaid)', async () => {
      const item = makeItem({
        key: 'deposit_received',
        autoCompleteRule: { type: 'invoicePaid', isDeposit: true },
      });
      const booking = makeBooking({ invoices: [{ isDeposit: true, status: 'PAID' }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ], []);
    });

    it('transitions PENDING → COMPLETE when activeContract exists', async () => {
      const item = makeItem({
        key: 'create_contract',
        autoCompleteRule: { type: 'bookingField', field: 'activeContract', operator: 'notNull' },
      });
      const booking = makeBooking({ contracts: [{ status: 'DRAFT' }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ], []);
    });
  });

  describe('contractSigned rule', () => {
    it('transitions PENDING → COMPLETE when contract is SIGNED', async () => {
      const item = makeItem({
        key: 'contract_signed',
        autoCompleteRule: { type: 'contractSigned' },
      });
      const booking = makeBooking({ contracts: [{ status: 'SIGNED' }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ], []);
    });
  });

  describe('musicFormResponse rule', () => {
    it('transitions PENDING → COMPLETE when music form response exists', async () => {
      const item = makeItem({
        key: 'song_requests',
        autoCompleteRule: { type: 'musicFormResponse' },
      });
      const booking = makeBooking({ musicFormResponse: { id: 'mfr1' } });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ], []);
    });
  });

  // ADR-0057 retires BLOCKED and dependsOn gating: a stored BLOCKED state is
  // normalised to its derived state (PENDING, or COMPLETE/FAILED if its own rule
  // fires), and nothing the evaluator emits is ever BLOCKED. Intra-goal order is
  // intrinsic step.order; inter-goal order is soft status. These tests pin the
  // retirement and its sanctioned consequence (out-of-order auto-complete).
  describe('BLOCKED retired (ADR-0057)', () => {
    it('normalises a stored BLOCKED goal to PENDING while its predecessor completes', async () => {
      const depItem = makeItem({
        id: 'ci1',
        key: 'create_contract',
        state: 'PENDING',
        dependsOn: [],
        autoCompleteRule: { type: 'bookingField', field: 'activeContract', operator: 'notNull' },
      });
      const blockedItem = makeItem({
        id: 'ci2',
        key: 'send_contract',
        state: 'BLOCKED',
        dependsOn: ['create_contract'],
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['contract_cover'] },
      });
      const booking = makeBooking({ contracts: [{ status: 'DRAFT' }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [depItem, blockedItem], booking });

      await service.evaluate('b1');

      const updates = repo.applyStateUpdates.mock.calls[0][0];
      const contractUpdate = updates.find((u: { id: string }) => u.id === 'ci1');
      const sendUpdate = updates.find((u: { id: string }) => u.id === 'ci2');
      expect(contractUpdate).toMatchObject({ state: 'COMPLETE' });
      expect(sendUpdate).toMatchObject({ state: 'PENDING' });
    });

    it('normalises a stored BLOCKED goal to PENDING even while a predecessor is still outstanding (no hard lock)', async () => {
      const depItem = makeItem({
        id: 'ci1',
        key: 'create_contract',
        state: 'PENDING',
        dependsOn: [],
        autoCompleteRule: null,
      });
      const blockedItem = makeItem({
        id: 'ci2',
        key: 'send_contract',
        state: 'BLOCKED',
        dependsOn: ['create_contract'],
        autoCompleteRule: null,
      });
      const booking = makeBooking();
      repo.findItemsWithContext.mockResolvedValue({ items: [depItem, blockedItem], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci2', state: 'PENDING' }),
      ], []);
    });

    it('auto-completes a goal out of order — its own rule fires regardless of an unfinished predecessor', async () => {
      // deposit_received's rule holds (deposit invoice PAID) before send_contract
      // is done. Pre-ADR-0057 the dep gate kept it BLOCKED; now it completes.
      const sendContract = makeItem({
        id: 'i-send',
        key: 'send_contract',
        state: 'PENDING',
        dependsOn: [],
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['contract_cover'] },
      });
      const depositReceived = makeItem({
        id: 'i-dep',
        key: 'deposit_received',
        state: 'BLOCKED',
        dependsOn: ['send_contract'],
        autoCompleteRule: { type: 'invoicePaid', isDeposit: true },
      });
      const booking = makeBooking({ invoices: [{ isDeposit: true, status: 'PAID' }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [sendContract, depositReceived], booking });

      await service.evaluate('b1');

      const updates = repo.applyStateUpdates.mock.calls[0][0];
      expect(updates.find((u: { id: string }) => u.id === 'i-dep')).toMatchObject({ state: 'COMPLETE' });
      // send_contract stays PENDING (its own rule unmet) — an unchanged goal emits
      // no update, and crucially is never written BLOCKED to gate the deposit.
      expect(updates.find((u: { id: string }) => u.id === 'i-send')).toBeUndefined();
    });

    it('never emits a BLOCKED state, even when seeded items carry dependsOn', async () => {
      const items = [
        makeItem({ id: 'i1', key: 'create_contract', state: 'COMPLETE', dependsOn: [], completedAt: new Date(), autoCompleteRule: null }),
        makeItem({ id: 'i2', key: 'send_contract', state: 'SKIPPED', dependsOn: ['create_contract'], autoCompleteRule: null }),
        makeItem({ id: 'i3', key: 'contract_signed', state: 'BLOCKED', dependsOn: ['send_contract'], autoCompleteRule: null }),
      ];
      const booking = makeBooking();
      repo.findItemsWithContext.mockResolvedValue({ items, booking });

      await service.evaluate('b1');

      const updates = repo.applyStateUpdates.mock.calls[0][0];
      expect(updates.every((u: { state: string }) => u.state !== 'BLOCKED')).toBe(true);
      expect(updates.find((u: { id: string }) => u.id === 'i3')).toMatchObject({ state: 'PENDING' });
    });

    it('does not touch an already-PENDING goal that has a dependsOn (no re-block)', async () => {
      const items = [
        makeItem({ id: 'i1', key: 'create_contract', state: 'COMPLETE', dependsOn: [], completedAt: new Date(), autoCompleteRule: null }),
        makeItem({ id: 'i2', key: 'send_contract', state: 'PENDING', dependsOn: ['create_contract'], autoCompleteRule: null }),
        makeItem({ id: 'i3', key: 'contract_signed', state: 'PENDING', dependsOn: ['send_contract'], autoCompleteRule: null }),
      ];
      const booking = makeBooking();
      repo.findItemsWithContext.mockResolvedValue({ items, booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });
  });

  describe('SKIPPED transitions (#50)', () => {
    it('does not skip send_quote when booking status is CONFIRMED (seeding rule handles this)', async () => {
      const item = makeItem({ key: 'send_quote', state: 'PENDING' });
      const booking = makeBooking({ status: 'CONFIRMED' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('does not skip send_quote when booking status is PROVISIONAL', async () => {
      const item = makeItem({ key: 'send_quote', state: 'PENDING' });
      const booking = makeBooking({ status: 'PROVISIONAL' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('skips the contract goal when booking status is READY', async () => {
      const item = makeItem({ key: 'get_contract_signed', state: 'PENDING' });
      const booking = makeBooking({ status: 'READY' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith([
        expect.objectContaining({ state: 'SKIPPED' }),
      ], []);
    });

    it('does not skip the contract goal when booking status is CONFIRMED', async () => {
      const item = makeItem({ key: 'get_contract_signed', state: 'PENDING' });
      const booking = makeBooking({ status: 'CONFIRMED' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('never skips an already-COMPLETE item', async () => {
      const item = makeItem({ key: 'send_quote', state: 'COMPLETE' });
      const booking = makeBooking({ status: 'CONFIRMED' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('never changes an already-SKIPPED item', async () => {
      const item = makeItem({ key: 'send_quote', state: 'SKIPPED' });
      const booking = makeBooking({ status: 'ENQUIRY' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });
  });

  describe('series-member money goal SKIP (ADR-0078)', () => {
    const depositGoal = (overrides: Record<string, unknown> = {}) =>
      makeItem({
        id: 'g-deposit',
        key: 'get_deposit_paid',
        state: 'PENDING',
        autoCompleteRule: null,
        steps: [
          { id: 's-create', key: 'create_deposit_invoice', state: 'PENDING', completedAt: null },
        ],
        ...overrides,
      });
    const balanceGoal = (overrides: Record<string, unknown> = {}) =>
      makeItem({
        id: 'g-balance',
        key: 'get_the_balance_paid',
        state: 'PENDING',
        autoCompleteRule: null,
        steps: [
          { id: 's-create-bal', key: 'create_balance_invoice', state: 'PENDING', completedAt: null },
        ],
        ...overrides,
      });

    it('skips get_deposit_paid when the booking is a series member', async () => {
      const booking = makeBooking({ seriesId: 'series-1' });
      repo.findItemsWithContext.mockResolvedValue({ items: [depositGoal()], booking });

      await service.evaluate('b1');

      const [goalUpdates, stepUpdates] = repo.applyStateUpdates.mock.calls[0];
      expect(goalUpdates).toEqual([expect.objectContaining({ id: 'g-deposit', state: 'SKIPPED' })]);
      // The goal-level SKIP short-circuits before step evaluation — its steps are untouched.
      expect(stepUpdates).toEqual([]);
    });

    it('skips get_the_balance_paid when the booking is a series member', async () => {
      const booking = makeBooking({ seriesId: 'series-1' });
      repo.findItemsWithContext.mockResolvedValue({ items: [balanceGoal()], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 'g-balance', state: 'SKIPPED' })],
        [],
      );
    });

    it('does not skip the money goals for a non-series booking', async () => {
      const booking = makeBooking({ seriesId: null });
      repo.findItemsWithContext.mockResolvedValue({ items: [depositGoal()], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('never clobbers an already-COMPLETE money goal on joining a series (stickiness wins)', async () => {
      const item = depositGoal({ state: 'COMPLETE', completedAt: new Date(), steps: undefined });
      const booking = makeBooking({ seriesId: 'series-1' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('does not resurrect a SKIPPED money goal after leaving the series (no auto-un-skip)', async () => {
      const item = depositGoal({ state: 'SKIPPED', steps: undefined });
      const booking = makeBooking({ seriesId: null });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('does not skip an unrelated goal for a series member', async () => {
      const item = makeItem({ key: 'send_quote', state: 'PENDING' });
      const booking = makeBooking({ seriesId: 'series-1' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });
  });

  describe('COMPLETE stickiness', () => {
    it('does not update items already in COMPLETE state', async () => {
      const item = makeItem({
        state: 'COMPLETE',
        autoCompleteRule: { type: 'communicationSent', templateTypes: ['quote'] },
      });
      const booking = makeBooking({ communications: [] }); // rule no longer met
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });
  });

  // #899 / ADR-0074 §5: DECLINED is a general, terminal step state. Nothing seeds it yet (that's
  // #900), but the evaluator must already treat a pre-existing DECLINED row correctly: sticky
  // (never re-opened by its predicate) and non-contributing to its goal's roll-up.
  describe('DECLINED step state (#899, general — not band-specific)', () => {
    it('is sticky — a DECLINED step is never re-evaluated by its predicate', async () => {
      const goal = makeItem({
        id: 'g-quote',
        key: 'get_the_quote_accepted',
        state: 'PENDING',
        autoCompleteRule: null,
        steps: [
          {
            id: 's1',
            key: 'send_quote',
            state: 'DECLINED',
            completedAt: null,
            bandMemberId: 'bm-1',
          },
        ],
      });
      // The rule condition holds — if the step were re-evaluated it would flip to COMPLETE.
      const booking = makeBooking({
        communications: [{ status: 'SENT', template: { builtInType: 'quote' } }],
      });
      repo.findItemsWithContext.mockResolvedValue({ items: [goal], booking });

      await service.evaluate('b1');

      // No step update for s1 (state unchanged): the goal rolls up to PENDING (no contributing
      // steps, the same guard as an empty list) and DECLINED is not itself contributing, so no
      // goal update fires either.
      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('rolls a goal up to COMPLETE around a DECLINED sibling step (non-contributing)', async () => {
      const goal = makeItem({
        id: 'g-quote',
        key: 'get_the_quote_accepted',
        state: 'PENDING',
        autoCompleteRule: null,
        steps: [
          { id: 's1', key: 'send_quote', state: 'DECLINED', completedAt: null, bandMemberId: null },
          { id: 's2', key: 'quote_accepted', state: 'COMPLETE', completedAt: new Date(), bandMemberId: null },
        ],
      });
      const booking = makeBooking();
      repo.findItemsWithContext.mockResolvedValue({ items: [goal], booking });

      await service.evaluate('b1');

      // Both steps are already in their sticky terminal states (no step updates), but the goal
      // itself flips PENDING → COMPLETE: DECLINED is excluded from the completion check, so the
      // one genuinely-complete sibling is enough — this is the failure mode #899 exists to avoid
      // (a decline must never leave the goal silently stuck PENDING forever).
      expect(repo.applyStateUpdates).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 'g-quote', state: 'COMPLETE' })],
        [],
      );
    });

    it('passes the step its own facts (bandMemberId) — existing single-arg predicates ignore it and behave identically', async () => {
      const goal = makeItem({
        id: 'g-quote',
        key: 'get_the_quote_accepted',
        state: 'PENDING',
        autoCompleteRule: null,
        steps: [
          { id: 's1', key: 'send_quote', state: 'PENDING', completedAt: null, bandMemberId: 'bm-1' },
        ],
      });
      const booking = makeBooking({
        communications: [{ status: 'SENT', template: { builtInType: 'quote' } }],
      });
      repo.findItemsWithContext.mockResolvedValue({ items: [goal], booking });

      await service.evaluate('b1');

      const [, stepUpdates] = repo.applyStateUpdates.mock.calls[0];
      expect(stepUpdates).toEqual([expect.objectContaining({ id: 's1', state: 'COMPLETE' })]);
    });
  });

  describe('full contract-sign integration (#49 / ADR-0057 multi-step)', () => {
    it('completes every step and rolls the contract goal up to COMPLETE when created, sent and signed', async () => {
      const goal = makeItem({
        id: 'g-contract',
        key: 'get_contract_signed',
        state: 'PENDING',
        autoCompleteRule: null, // multi-step goal: state rolls up from its steps
        steps: [
          { id: 's1', key: 'create_contract', state: 'PENDING', completedAt: null },
          { id: 's2', key: 'send_contract', state: 'PENDING', completedAt: null },
          { id: 's3', key: 'contract_signed', state: 'PENDING', completedAt: null },
        ],
      });
      const booking = makeBooking({
        status: 'CONFIRMED',
        contracts: [{ status: 'SIGNED' }],
        communications: [{ status: 'SENT', template: { builtInType: 'contract_cover' } }],
      });
      repo.findItemsWithContext.mockResolvedValue({ items: [goal], booking });

      await service.evaluate('b1');

      const [goalUpdates, stepUpdates] = repo.applyStateUpdates.mock.calls[0];
      expect(goalUpdates).toEqual([expect.objectContaining({ id: 'g-contract', state: 'COMPLETE' })]);
      expect(stepUpdates.find((u: { id: string }) => u.id === 's1')).toMatchObject({ state: 'COMPLETE' });
      expect(stepUpdates.find((u: { id: string }) => u.id === 's2')).toMatchObject({ state: 'COMPLETE' });
      expect(stepUpdates.find((u: { id: string }) => u.id === 's3')).toMatchObject({ state: 'COMPLETE' });
    });

    it('keeps the contract goal PENDING and surfaces the active step while the client has not signed', async () => {
      const goal = makeItem({
        id: 'g-contract',
        key: 'get_contract_signed',
        state: 'PENDING',
        autoCompleteRule: null,
        steps: [
          { id: 's1', key: 'create_contract', state: 'COMPLETE', completedAt: new Date() },
          { id: 's2', key: 'send_contract', state: 'PENDING', completedAt: null },
          { id: 's3', key: 'contract_signed', state: 'PENDING', completedAt: null },
        ],
      });
      // Contract exists + sent, but not signed → send step completes, goal stays PENDING.
      const booking = makeBooking({
        status: 'CONFIRMED',
        contracts: [{ status: 'SENT' }],
        communications: [{ status: 'SENT', template: { builtInType: 'contract_cover' } }],
      });
      repo.findItemsWithContext.mockResolvedValue({ items: [goal], booking });

      await service.evaluate('b1');

      const [goalUpdates, stepUpdates] = repo.applyStateUpdates.mock.calls[0];
      // Goal stays PENDING (not all steps complete) → no goal update emitted.
      expect(goalUpdates).toEqual([]);
      expect(stepUpdates).toEqual([expect.objectContaining({ id: 's2', state: 'COMPLETE' })]);
    });
  });

  describe('multi-step goal roll-up (ADR-0057)', () => {
    it('rolls a multi-step goal up to COMPLETE when every step completes', async () => {
      const goal = makeItem({
        id: 'g-deposit',
        key: 'deposit_invoice',
        state: 'PENDING',
        autoCompleteRule: null, // multi-step goals carry no own rule
        steps: [
          { id: 's1', key: 'create_deposit_invoice', state: 'PENDING', completedAt: null },
          { id: 's2', key: 'deposit_received', state: 'PENDING', completedAt: null },
        ],
      });
      const booking = makeBooking({ invoices: [{ isDeposit: true, status: 'PAID' }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [goal], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 'g-deposit', state: 'COMPLETE' })],
        [
          expect.objectContaining({ id: 's1', state: 'COMPLETE' }),
          expect.objectContaining({ id: 's2', state: 'COMPLETE' }),
        ],
      );
    });

    it('rolls a multi-step goal up to FAILED when any step fails (bounced send)', async () => {
      const goal = makeItem({
        id: 'g-deposit',
        key: 'deposit_invoice',
        state: 'PENDING',
        autoCompleteRule: null,
        steps: [
          { id: 's1', key: 'create_deposit_invoice', state: 'COMPLETE', completedAt: new Date() },
          { id: 's2', key: 'send_balance_invoice', state: 'PENDING', completedAt: null },
        ],
      });
      const booking = makeBooking({
        invoices: [{ isDeposit: true }],
        communications: [{ status: 'FAILED', template: { builtInType: 'balance_invoice_cover' } }],
      });
      repo.findItemsWithContext.mockResolvedValue({ items: [goal], booking });

      await service.evaluate('b1');

      expect(repo.applyStateUpdates).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 'g-deposit', state: 'FAILED' })],
        [expect.objectContaining({ id: 's2', state: 'FAILED' })],
      );
    });
  });

  describe('evaluateForEvent (event-targeted, ADR-0057)', () => {
    const ALL_INPUTS = [
      'communications',
      'invoices',
      'contracts',
      'musicFormResponse',
      'venueId',
      'customerId',
      'setsCount',
      'logistics',
    ] as const;

    function fixture() {
      return [
        makeItem({ id: 'i-inv', key: 'create_deposit_invoice', state: 'PENDING', autoCompleteRule: { type: 'invoiceExists', isDeposit: true } }),
        makeItem({ id: 'i-venue', key: 'add_venue', state: 'PENDING', autoCompleteRule: { type: 'completeness', concern: 'venue' } }),
        makeItem({ id: 'i-sign', key: 'contract_signed', state: 'PENDING', autoCompleteRule: { type: 'contractSigned' } }),
      ];
    }

    it('produces the same updates as a full sweep when all inputs are flagged changed', async () => {
      const booking = makeBooking({ invoices: [{ isDeposit: true }], venueId: 'v1', contracts: [{ status: 'SIGNED' }] });

      // Freeze the clock: each COMPLETE update stamps `completedAt: new Date()`, so the two
      // independent evaluations below would otherwise capture different timestamps and the deep
      // equality flakes whenever they straddle a millisecond.
      jest.useFakeTimers().setSystemTime(new Date('2026-06-30T12:00:00.000Z'));
      try {
        repo.findItemsWithContext.mockResolvedValue({ items: fixture(), booking });
        await service.evaluate('b1');
        const fullSweep = repo.applyStateUpdates.mock.calls[0][0];

        repo.applyStateUpdates.mockClear();
        repo.findItemsWithContext.mockResolvedValue({ items: fixture(), booking });
        await service.evaluateForEvent('b1', [...ALL_INPUTS]);
        const targeted = repo.applyStateUpdates.mock.calls[0][0];

        const byId = (us: Array<{ id: string }>) => [...us].sort((a, b) => a.id.localeCompare(b.id));
        expect(byId(targeted)).toEqual(byId(fullSweep));
      } finally {
        jest.useRealTimers();
      }
    });

    it('re-evaluates only the goals whose inputs changed', async () => {
      const booking = makeBooking({ invoices: [{ isDeposit: true }], venueId: 'v1', contracts: [{ status: 'SIGNED' }] });
      repo.findItemsWithContext.mockResolvedValue({ items: fixture(), booking });

      await service.evaluateForEvent('b1', ['invoices']);

      const updates = repo.applyStateUpdates.mock.calls[0][0];
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ id: 'i-inv', state: 'COMPLETE' });
      expect(updates.find((u: { id: string }) => u.id === 'i-venue')).toBeUndefined();
      expect(updates.find((u: { id: string }) => u.id === 'i-sign')).toBeUndefined();
    });

    it('does nothing when no goal observes the changed input', async () => {
      const booking = makeBooking({ invoices: [{ isDeposit: true }] });
      repo.findItemsWithContext.mockResolvedValue({ items: fixture(), booking });

      // 'setsCount' is observed only by build_itinerary, absent from this fixture.
      await service.evaluateForEvent('b1', ['setsCount']);

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });

    it('leaves a manually-COMPLETE goal sticky even when targeted', async () => {
      const items = [
        makeItem({ id: 'i-inv', key: 'create_deposit_invoice', state: 'COMPLETE', completedAt: new Date(), autoCompleteRule: { type: 'invoiceExists', isDeposit: true } }),
      ];
      const booking = makeBooking({ invoices: [] }); // rule no longer holds
      repo.findItemsWithContext.mockResolvedValue({ items, booking });

      await service.evaluateForEvent('b1', ['invoices']);

      expect(repo.applyStateUpdates).not.toHaveBeenCalled();
    });
  });

  describe('band checklist (#900)', () => {
    it('reloads the goal after roster steps are materialised', async () => {
      const previousFlag = process.env.FEATURE_BAND_MEMBERS;
      process.env.FEATURE_BAND_MEMBERS = 'true';
      try {
        const booking = makeBooking({
          bandMembers: [{ id: 'm-dave', status: 'CONFIRMED', isSelf: false }],
          bandChairs: [{ memberId: 'm-dave', memberStatus: 'CONFIRMED' }],
        });
        const staticSteps = [
          { id: 's-lineup', key: 'choose_a_lineup', state: 'PENDING', completedAt: null, bandMemberId: null },
          { id: 's-fill', key: 'fill_every_chair', state: 'PENDING', completedAt: null, bandMemberId: null },
        ];
        const staticGoal = makeItem({
          id: 'g-band',
          key: 'get_the_band_confirmed',
          autoCompleteRule: null,
          steps: staticSteps,
        });
        const materialisedGoal = makeItem({
          id: 'g-band',
          key: 'get_the_band_confirmed',
          autoCompleteRule: null,
          steps: [
            ...staticSteps,
            { id: 's-invite', key: 'invite_band_member', state: 'PENDING', completedAt: null, bandMemberId: 'm-dave' },
            { id: 's-confirm', key: 'band_member_confirmed', state: 'PENDING', completedAt: null, bandMemberId: 'm-dave' },
          ],
        });
        repo.findBandChecklistStepSyncData.mockResolvedValue({
          goals: [{
            id: 'g-band', key: 'get_the_band_confirmed', userId: 'u1', state: 'PENDING', steps: staticSteps,
          }],
          members: [{
            id: 'm-dave', status: 'CONFIRMED', isSelf: false, contactId: 'c-dave', createdAt: new Date(), contact: { name: 'Dave' },
          }],
          chairs: [{ memberId: 'm-dave', memberStatus: 'CONFIRMED' }],
        });
        repo.findItemsWithContext
          .mockResolvedValueOnce({ items: [staticGoal], booking })
          .mockResolvedValueOnce({ items: [materialisedGoal], booking });

        await service.evaluate('b1');

        expect(repo.findItemsWithContext).toHaveBeenCalledTimes(2);
        expect(repo.applyBandMemberStepSyncPlan).toHaveBeenCalledWith(
          'u1',
          'b1',
          'g-band',
          expect.objectContaining({ createSteps: expect.any(Array) }),
        );
        expect(repo.applyStateUpdates).toHaveBeenCalledWith(
          [expect.objectContaining({ id: 'g-band', state: 'COMPLETE' })],
          expect.arrayContaining([
            expect.objectContaining({ id: 's-invite', state: 'COMPLETE' }),
            expect.objectContaining({ id: 's-confirm', state: 'COMPLETE' }),
          ]),
        );
      } finally {
        if (previousFlag === undefined) delete process.env.FEATURE_BAND_MEMBERS;
        else process.env.FEATURE_BAND_MEMBERS = previousFlag;
      }
    });

    it('completes the band goal after lineup, filled chairs, invites, and all confirmations', async () => {
      const previousFlag = process.env.FEATURE_BAND_MEMBERS;
      process.env.FEATURE_BAND_MEMBERS = 'true';
      try {
        const goal = makeItem({
          id: 'g-band',
          key: 'get_the_band_confirmed',
          autoCompleteRule: null,
          steps: [
            { id: 's-lineup', key: 'choose_a_lineup', state: 'PENDING', completedAt: null, bandMemberId: null },
            { id: 's-fill', key: 'fill_every_chair', state: 'PENDING', completedAt: null, bandMemberId: null },
            { id: 's-invite-dave', key: 'invite_band_member', state: 'PENDING', completedAt: null, bandMemberId: 'm-dave' },
            { id: 's-confirm-dave', key: 'band_member_confirmed', state: 'PENDING', completedAt: null, bandMemberId: 'm-dave' },
            { id: 's-invite-sam', key: 'invite_band_member', state: 'PENDING', completedAt: null, bandMemberId: 'm-sam' },
            { id: 's-confirm-sam', key: 'band_member_confirmed', state: 'PENDING', completedAt: null, bandMemberId: 'm-sam' },
          ],
        });
        repo.findItemsWithContext.mockResolvedValue({
          items: [goal],
          booking: makeBooking({
            bandMembers: [
              { id: 'm-dave', status: 'CONFIRMED', isSelf: false },
              { id: 'm-sam', status: 'CONFIRMED', isSelf: false },
            ],
            bandChairs: [
              { memberId: 'm-dave', memberStatus: 'CONFIRMED' },
              { memberId: 'm-sam', memberStatus: 'CONFIRMED' },
            ],
          }),
        });

        await service.evaluate('b1');

        expect(repo.applyStateUpdates).toHaveBeenCalledWith(
          [expect.objectContaining({ id: 'g-band', state: 'COMPLETE' })],
          [
            expect.objectContaining({ id: 's-lineup', state: 'COMPLETE' }),
            expect.objectContaining({ id: 's-fill', state: 'COMPLETE' }),
            expect.objectContaining({ id: 's-invite-dave', state: 'COMPLETE' }),
            expect.objectContaining({ id: 's-confirm-dave', state: 'COMPLETE' }),
            expect.objectContaining({ id: 's-invite-sam', state: 'COMPLETE' }),
            expect.objectContaining({ id: 's-confirm-sam', state: 'COMPLETE' }),
          ],
        );
      } finally {
        if (previousFlag === undefined) delete process.env.FEATURE_BAND_MEMBERS;
        else process.env.FEATURE_BAND_MEMBERS = previousFlag;
      }
    });

    it('materialises person-scoped rules, keeps declines, and leaves the vacancy precondition pending', async () => {
      const previousFlag = process.env.FEATURE_BAND_MEMBERS;
      process.env.FEATURE_BAND_MEMBERS = 'true';
      try {
        const goal = makeItem({
          id: 'g-band',
          key: 'get_the_band_confirmed',
          autoCompleteRule: null,
          steps: [
            { id: 's-lineup', key: 'choose_a_lineup', state: 'PENDING', completedAt: null, bandMemberId: null },
            { id: 's-fill', key: 'fill_every_chair', state: 'PENDING', completedAt: null, bandMemberId: null },
            { id: 's-invite-dave', key: 'invite_band_member', state: 'PENDING', completedAt: null, bandMemberId: 'm-dave' },
            { id: 's-confirm-dave', key: 'band_member_confirmed', state: 'PENDING', completedAt: null, bandMemberId: 'm-dave' },
            { id: 's-invite-sam', key: 'invite_band_member', state: 'PENDING', completedAt: null, bandMemberId: 'm-sam' },
            { id: 's-confirm-sam', key: 'band_member_confirmed', state: 'PENDING', completedAt: null, bandMemberId: 'm-sam' },
          ],
        });
        repo.findItemsWithContext.mockResolvedValue({
          items: [goal],
          booking: makeBooking({
            bandMembers: [
              { id: 'm-dave', status: 'DECLINED', isSelf: false },
              { id: 'm-sam', status: 'INVITED', isSelf: false },
            ],
            bandChairs: [
              { memberId: null, memberStatus: null },
              { memberId: 'm-sam', memberStatus: 'INVITED' },
            ],
          }),
        });

        await service.evaluate('b1');

        expect(repo.findBandChecklistStepSyncData).toHaveBeenCalledWith('u1', 'b1');
        expect(repo.applyStateUpdates).toHaveBeenCalledWith(
          [],
          [
            expect.objectContaining({ id: 's-lineup', state: 'COMPLETE' }),
            expect.objectContaining({ id: 's-invite-dave', state: 'COMPLETE' }),
            expect.objectContaining({ id: 's-confirm-dave', state: 'DECLINED' }),
            expect.objectContaining({ id: 's-invite-sam', state: 'COMPLETE' }),
          ],
        );
        // A decline stays honest history but the now-vacant chair keeps the goal open.
        expect(repo.applyStateUpdates.mock.calls[0][0]).not.toContainEqual(
          expect.objectContaining({ id: 'g-band', state: 'COMPLETE' }),
        );
      } finally {
        if (previousFlag === undefined) delete process.env.FEATURE_BAND_MEMBERS;
        else process.env.FEATURE_BAND_MEMBERS = previousFlag;
      }
    });

    describe('get_the_band_briefed (#901)', () => {
      const dave = {
        id: 'm-dave', status: 'CONFIRMED', isSelf: false, contactId: 'c-dave', createdAt: new Date('2026-01-01'), contact: { name: 'Dave' },
      };
      const sam = {
        id: 'm-sam', status: 'CONFIRMED', isSelf: false, contactId: 'c-sam', createdAt: new Date('2026-01-02'), contact: { name: 'Sam' },
      };
      const briefStep = (id: string, bandMemberId: string) =>
        ({ id, key: 'brief_band_member', state: 'PENDING', completedAt: null, bandMemberId });
      const finalDetails = (contactId: string, builtInType = 'band_final_details') =>
        ({ status: 'SENT', contactId, template: { builtInType } });
      let previousFlag: string | undefined;

      beforeEach(() => {
        previousFlag = process.env.FEATURE_BAND_MEMBERS;
        process.env.FEATURE_BAND_MEMBERS = 'true';
      });
      afterEach(() => {
        if (previousFlag === undefined) delete process.env.FEATURE_BAND_MEMBERS;
        else process.env.FEATURE_BAND_MEMBERS = previousFlag;
      });

      it('materialises Brief rows even when the confirmed goal was never seeded (READY-start booking)', async () => {
        const emptyGoal = makeItem({ id: 'g-brief', key: 'get_the_band_briefed', autoCompleteRule: null, steps: [] });
        const materialised = makeItem({
          id: 'g-brief', key: 'get_the_band_briefed', autoCompleteRule: null,
          steps: [briefStep('s-brief-dave', 'm-dave')],
        });
        repo.findBandChecklistStepSyncData.mockResolvedValue({
          goals: [{ id: 'g-brief', key: 'get_the_band_briefed', userId: 'u1', state: 'PENDING', steps: [] }],
          members: [dave],
          chairs: [],
        });
        const booking = makeBooking({ status: 'READY', communications: [finalDetails('c-dave')] });
        repo.findItemsWithContext
          .mockResolvedValueOnce({ items: [emptyGoal], booking })
          .mockResolvedValueOnce({ items: [materialised], booking });

        await service.evaluate('b1');

        expect(repo.applyBandMemberStepSyncPlan).toHaveBeenCalledWith('u1', 'b1', 'g-brief', expect.objectContaining({
          createSteps: [expect.objectContaining({ memberId: 'm-dave', label: 'Brief Dave', order: 1 })],
        }));
        expect(repo.applyStateUpdates).toHaveBeenCalledWith(
          [expect.objectContaining({ id: 'g-brief', state: 'COMPLETE' })],
          [expect.objectContaining({ id: 's-brief-dave', state: 'COMPLETE' })],
        );
      });

      it('keeps the COMPLETE-stage goal open while any member is unbriefed', async () => {
        const goal = makeItem({
          id: 'g-brief', key: 'get_the_band_briefed', autoCompleteRule: null,
          steps: [briefStep('s-brief-dave', 'm-dave'), briefStep('s-brief-sam', 'm-sam')],
        });
        repo.findBandChecklistStepSyncData.mockResolvedValue({
          goals: [{
            id: 'g-brief', key: 'get_the_band_briefed', userId: 'u1', state: 'PENDING',
            steps: [
              { id: 's-brief-dave', key: 'brief_band_member', bandMemberId: 'm-dave', label: 'Brief Dave', order: 1, state: 'PENDING' },
              { id: 's-brief-sam', key: 'brief_band_member', bandMemberId: 'm-sam', label: 'Brief Sam', order: 2, state: 'PENDING' },
            ],
          }],
          members: [dave, sam],
          chairs: [],
        });
        // Dave's details went by copy-paste (Mark as sent logs the message template); Sam has only had the call sheet.
        repo.findItemsWithContext.mockResolvedValue({
          items: [goal],
          booking: makeBooking({
            status: 'READY',
            communications: [finalDetails('c-dave', 'band_final_details_message'), finalDetails('c-sam', 'band_call_sheet')],
          }),
        });

        await service.evaluate('b1');

        expect(repo.applyBandMemberStepSyncPlan).not.toHaveBeenCalled();
        expect(repo.applyStateUpdates).toHaveBeenCalledWith(
          [],
          [expect.objectContaining({ id: 's-brief-dave', state: 'COMPLETE' })],
        );
      });

      it('leaves the briefed goal inert while the feature flag is off', async () => {
        delete process.env.FEATURE_BAND_MEMBERS;
        repo.findItemsWithContext.mockResolvedValue({
          items: [makeItem({ id: 'g-brief', key: 'get_the_band_briefed', autoCompleteRule: null, steps: [] })],
          booking: makeBooking({ communications: [finalDetails('c-dave')] }),
        });

        await service.evaluate('b1');

        expect(repo.findBandChecklistStepSyncData).not.toHaveBeenCalled();
        expect(repo.applyStateUpdates).not.toHaveBeenCalled();
      });
    });

    it('does not evaluate or change an existing band goal while the feature flag is off', async () => {
      const previousFlag = process.env.FEATURE_BAND_MEMBERS;
      delete process.env.FEATURE_BAND_MEMBERS;
      try {
        repo.findItemsWithContext.mockResolvedValue({
          items: [makeItem({ id: 'g-band', key: 'get_the_band_confirmed', autoCompleteRule: null, steps: [] })],
          booking: makeBooking({ bandChairs: [{ memberId: 'm1', memberStatus: 'CONFIRMED' }] }),
        });

        await service.evaluate('b1');

        expect(repo.findBandChecklistStepSyncData).not.toHaveBeenCalled();
        expect(repo.applyStateUpdates).not.toHaveBeenCalled();
      } finally {
        if (previousFlag !== undefined) process.env.FEATURE_BAND_MEMBERS = previousFlag;
      }
    });
  });
});
