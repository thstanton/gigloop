import { ChecklistEvaluatorService } from './checklist-evaluator.service';
import { ChecklistRepository } from './checklist.repository';

type MockRepo = {
  findItemsWithContext: jest.Mock;
  updateItemStates: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findItemsWithContext: jest.fn(),
    updateItemStates: jest.fn().mockResolvedValue(undefined),
  };
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    userId: 'u1',
    status: 'ENQUIRY',
    venueId: null,
    customerId: 'cust-1',
    depositReceivedAt: null,
    setsCount: 0,
    logistics: null,
    communications: [],
    invoices: [],
    contracts: [],
    musicFormResponse: null,
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
    expect(repo.updateItemStates).not.toHaveBeenCalled();
  });

  it('does nothing when no items', async () => {
    repo.findItemsWithContext.mockResolvedValue({ items: [], booking: makeBooking() });
    await service.evaluate('b1');
    expect(repo.updateItemStates).not.toHaveBeenCalled();
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

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ]);
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

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'FAILED' }),
      ]);
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

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ]);
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

      expect(repo.updateItemStates).not.toHaveBeenCalled();
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

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci-venue', state: 'COMPLETE' }),
      ]);
    });

    it('stays PENDING when venueId is unset', async () => {
      const item = addVenueItem();
      const booking = makeBooking({ venueId: null });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
    });

    it('does not regress an already-COMPLETE item when venueId is later cleared', async () => {
      // Matches existing evaluator semantics: COMPLETE items are not re-evaluated, so
      // clearing the venue does not bounce add_venue back to PENDING.
      const item = addVenueItem({ state: 'COMPLETE', completedAt: new Date() });
      const booking = makeBooking({ venueId: null });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
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

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci-itinerary', state: 'COMPLETE' }),
      ]);
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

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci-itinerary', state: 'COMPLETE' }),
      ]);
    });

    it('stays PENDING when no sets exist', async () => {
      const item = buildItineraryItem();
      const booking = makeBooking({ setsCount: 0 });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
    });

    it('does not regress an already-COMPLETE item when sets are later removed (sticky COMPLETE)', async () => {
      const item = buildItineraryItem({ state: 'COMPLETE', completedAt: new Date() });
      const booking = makeBooking({ setsCount: 0 });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
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

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ]);
    });

    it('does not match when only balance invoice exists for deposit rule', async () => {
      const item = makeItem({
        key: 'create_deposit_invoice',
        autoCompleteRule: { type: 'invoiceExists', isDeposit: true },
      });
      const booking = makeBooking({ invoices: [{ isDeposit: false }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
    });
  });

  describe('bookingField rule', () => {
    it('transitions PENDING → COMPLETE when depositReceivedAt is set', async () => {
      const item = makeItem({
        key: 'deposit_received',
        autoCompleteRule: { type: 'bookingField', field: 'depositReceivedAt', operator: 'notNull' },
      });
      const booking = makeBooking({ depositReceivedAt: new Date() });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ]);
    });

    it('transitions PENDING → COMPLETE when activeContract exists', async () => {
      const item = makeItem({
        key: 'create_contract',
        autoCompleteRule: { type: 'bookingField', field: 'activeContract', operator: 'notNull' },
      });
      const booking = makeBooking({ contracts: [{ status: 'DRAFT' }] });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ]);
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

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ]);
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

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci1', state: 'COMPLETE' }),
      ]);
    });
  });

  describe('dependsOn unblocking', () => {
    it('unblocks BLOCKED item when its dependency transitions to COMPLETE in the same pass', async () => {
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

      const updates = repo.updateItemStates.mock.calls[0][0];
      const contractUpdate = updates.find((u: { id: string }) => u.id === 'ci1');
      const sendUpdate = updates.find((u: { id: string }) => u.id === 'ci2');
      expect(contractUpdate).toMatchObject({ state: 'COMPLETE' });
      expect(sendUpdate).toMatchObject({ state: 'PENDING' });
    });

    it('keeps item BLOCKED when a present dependency is genuinely outstanding (PENDING)', async () => {
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

      expect(repo.updateItemStates).not.toHaveBeenCalled();
    });
  });

  describe('dependsOn satisfied by SKIPPED/absent (#554)', () => {
    it('treats an absent dependency as satisfied — unblocks downstream to PENDING', async () => {
      const item = makeItem({
        id: 'ci2',
        key: 'send_contract',
        state: 'BLOCKED',
        dependsOn: ['create_contract'], // create_contract not in items list — absent
        autoCompleteRule: null,
      });
      const booking = makeBooking();
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'ci2', state: 'PENDING' }),
      ]);
    });

    it('treats a SKIPPED mid-chain dependency as satisfied — downstream goes PENDING, not BLOCKED', async () => {
      const items = [
        makeItem({ id: 'i1', key: 'create_contract', state: 'COMPLETE', dependsOn: [], completedAt: new Date(), autoCompleteRule: null }),
        makeItem({ id: 'i2', key: 'send_contract', state: 'SKIPPED', dependsOn: ['create_contract'], autoCompleteRule: null }),
        makeItem({ id: 'i3', key: 'contract_signed', state: 'BLOCKED', dependsOn: ['send_contract'], autoCompleteRule: null }),
      ];
      const booking = makeBooking();
      repo.findItemsWithContext.mockResolvedValue({ items, booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'i3', state: 'PENDING' }),
      ]);
    });

    it('re-blocks downstream when a previously-SKIPPED dependency is un-skipped back to PENDING', async () => {
      // Post-skip state: send_contract is PENDING again, contract_signed had been
      // unblocked to PENDING — un-skipping must drive it back PENDING → BLOCKED.
      const items = [
        makeItem({ id: 'i1', key: 'create_contract', state: 'COMPLETE', dependsOn: [], completedAt: new Date(), autoCompleteRule: null }),
        makeItem({ id: 'i2', key: 'send_contract', state: 'PENDING', dependsOn: ['create_contract'], autoCompleteRule: null }),
        makeItem({ id: 'i3', key: 'contract_signed', state: 'PENDING', dependsOn: ['send_contract'], autoCompleteRule: null }),
      ];
      const booking = makeBooking();
      repo.findItemsWithContext.mockResolvedValue({ items, booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'i3', state: 'BLOCKED' }),
      ]);
    });
  });

  describe('SKIPPED transitions (#50)', () => {
    it('does not skip send_quote when booking status is CONFIRMED (seeding rule handles this)', async () => {
      const item = makeItem({ key: 'send_quote', state: 'PENDING' });
      const booking = makeBooking({ status: 'CONFIRMED' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
    });

    it('does not skip send_quote when booking status is PROVISIONAL', async () => {
      const item = makeItem({ key: 'send_quote', state: 'PENDING' });
      const booking = makeBooking({ status: 'PROVISIONAL' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
    });

    it('skips contract_signed when booking status is READY', async () => {
      const item = makeItem({ key: 'contract_signed', state: 'PENDING' });
      const booking = makeBooking({ status: 'READY' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).toHaveBeenCalledWith([
        expect.objectContaining({ state: 'SKIPPED' }),
      ]);
    });

    it('does not skip contract_signed when booking status is CONFIRMED', async () => {
      const item = makeItem({ key: 'contract_signed', state: 'PENDING' });
      const booking = makeBooking({ status: 'CONFIRMED' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
    });

    it('never skips an already-COMPLETE item', async () => {
      const item = makeItem({ key: 'send_quote', state: 'COMPLETE' });
      const booking = makeBooking({ status: 'CONFIRMED' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
    });

    it('never changes an already-SKIPPED item', async () => {
      const item = makeItem({ key: 'send_quote', state: 'SKIPPED' });
      const booking = makeBooking({ status: 'ENQUIRY' });
      repo.findItemsWithContext.mockResolvedValue({ items: [item], booking });

      await service.evaluate('b1');

      expect(repo.updateItemStates).not.toHaveBeenCalled();
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

      expect(repo.updateItemStates).not.toHaveBeenCalled();
    });
  });

  describe('full contract-sign integration (#49)', () => {
    it('marks create_contract COMPLETE then unblocks send_contract then marks contract_signed when signed', async () => {
      const items = [
        makeItem({ id: 'i1', key: 'create_contract', state: 'PENDING', dependsOn: [], autoCompleteRule: { type: 'bookingField', field: 'activeContract', operator: 'notNull' } }),
        makeItem({ id: 'i2', key: 'send_contract', state: 'BLOCKED', dependsOn: ['create_contract'], autoCompleteRule: { type: 'communicationSent', templateTypes: ['contract_cover'] } }),
        makeItem({ id: 'i3', key: 'contract_signed', state: 'BLOCKED', dependsOn: ['send_contract'], autoCompleteRule: { type: 'contractSigned' } }),
      ];
      const booking = makeBooking({
        status: 'ENQUIRY',
        contracts: [{ status: 'SIGNED' }],
        communications: [{ status: 'SENT', template: { builtInType: 'contract_cover' } }],
      });
      repo.findItemsWithContext.mockResolvedValue({ items, booking });

      await service.evaluate('b1');

      const updates = repo.updateItemStates.mock.calls[0][0];
      expect(updates.find((u: { id: string }) => u.id === 'i1')).toMatchObject({ state: 'COMPLETE' });
      expect(updates.find((u: { id: string }) => u.id === 'i2')).toMatchObject({ state: 'COMPLETE' });
      expect(updates.find((u: { id: string }) => u.id === 'i3')).toMatchObject({ state: 'COMPLETE' });
    });
  });
});
