import { ChecklistRepository } from './checklist.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  booking: { findMany: jest.Mock };
  bookingChecklistItem: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    createMany: jest.Mock;
  };
  bookingChecklistStep: {
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  return {
    booking: { findMany: jest.fn() },
    bookingChecklistItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    bookingChecklistStep: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

const TODAY = new Date('2025-01-06T00:00:00.000Z');
const REMINDER_LEAD_DAYS = 7;

function makeItem(overrides: Partial<{
  id: string;
  key: string | null;
  label: string;
  state: string;
  dueDate: Date | null;
  requiredForStatus: string | null;
  order: number;
}> = {}) {
  return {
    id: 'item-1',
    key: 'send_quote',
    label: 'Send quote',
    state: 'PENDING',
    dueDate: null,
    requiredForStatus: null,
    order: 0,
    ...overrides,
  };
}

function makeBooking(overrides: Partial<{
  id: string;
  date: Date;
  title: string | null;
  status: string;
  customer: { name: string };
  venue: { name: string } | null;
  checklistItems: ReturnType<typeof makeItem>[];
}> = {}) {
  return {
    id: 'booking-1',
    date: new Date('2025-01-20T19:00:00.000Z'),
    title: 'Wedding',
    status: 'CONFIRMED',
    customer: { name: 'Alice Smith' },
    venue: null,
    checklistItems: [],
    ...overrides,
  };
}

describe('ChecklistRepository — findActionItems', () => {
  let repo: ChecklistRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new ChecklistRepository(prisma as unknown as PrismaService);
  });

  it('returns empty array when no bookings have surfaceable items', async () => {
    prisma.booking.findMany.mockResolvedValue([]);

    const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

    expect(result).toHaveLength(0);
  });

  it('excludes bookings whose items are not surfaceable (undated, no requiredForStatus)', async () => {
    const booking = makeBooking({ checklistItems: [makeItem({ dueDate: null, requiredForStatus: null })] });
    prisma.booking.findMany.mockResolvedValue([booking]);

    const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

    expect(result).toHaveLength(0);
  });

  describe('surfacing rule 1: dated items', () => {
    it('surfaces a dated item whose dueDate is within the lead window', async () => {
      const item = makeItem({ dueDate: new Date('2025-01-10T00:00:00.000Z') }); // today+4
      const booking = makeBooking({ checklistItems: [item] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(1);
      expect(result[0].item.id).toBe('item-1');
    });

    it('does not surface a dated item whose dueDate is beyond the lead window', async () => {
      const item = makeItem({ dueDate: new Date('2025-01-20T00:00:00.000Z') }); // today+14
      const booking = makeBooking({ checklistItems: [item] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(0);
    });

    it('surfaces a dated item whose dueDate equals exactly the cutoff', async () => {
      const item = makeItem({ dueDate: new Date('2025-01-13T00:00:00.000Z') }); // today+7
      const booking = makeBooking({ checklistItems: [item] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(1);
    });
  });

  describe('surfacing rule 2: undated status-gate items', () => {
    it('surfaces an undated status-gate item when it is the only blocker for that status', async () => {
      const item = makeItem({ requiredForStatus: 'CONFIRMED' });
      const booking = makeBooking({ checklistItems: [item] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(1);
      expect(result[0].item.id).toBe('item-1');
    });

    it('does not surface an undated status-gate item when other blockers for the same status exist', async () => {
      const item1 = makeItem({ id: 'item-1', requiredForStatus: 'CONFIRMED' });
      const item2 = makeItem({ id: 'item-2', requiredForStatus: 'CONFIRMED', order: 1 });
      const booking = makeBooking({ checklistItems: [item1, item2] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(0);
    });
  });

  describe('stage gate', () => {
    it('does not surface an item required for a stage the booking has already passed', async () => {
      // deposit (requiredForStatus CONFIRMED), due within window, on a COMPLETE booking
      const item = makeItem({ dueDate: new Date('2025-01-10T00:00:00.000Z'), requiredForStatus: 'CONFIRMED' });
      const booking = makeBooking({ status: 'COMPLETE', checklistItems: [item] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(0);
    });

    it('surfaces the same item while the booking is still at that stage', async () => {
      const item = makeItem({ dueDate: new Date('2025-01-10T00:00:00.000Z'), requiredForStatus: 'CONFIRMED' });
      const booking = makeBooking({ status: 'CONFIRMED', checklistItems: [item] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(1);
    });
  });

  describe('first-item selection', () => {
    it('returns only the first surfaceable item per booking ordered by order', async () => {
      const item1 = makeItem({ id: 'item-1', dueDate: new Date('2025-01-08T00:00:00.000Z'), order: 0 });
      const item2 = makeItem({ id: 'item-2', dueDate: new Date('2025-01-09T00:00:00.000Z'), order: 1 });
      const booking = makeBooking({ checklistItems: [item1, item2] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(1);
      expect(result[0].item.id).toBe('item-1');
    });

    it('skips non-surfaceable items to reach the first surfaceable one', async () => {
      const notSurfaceable = makeItem({ id: 'item-1', dueDate: null, requiredForStatus: null, order: 0 });
      const surfaceable = makeItem({ id: 'item-2', dueDate: new Date('2025-01-08T00:00:00.000Z'), order: 1 });
      const booking = makeBooking({ checklistItems: [notSurfaceable, surfaceable] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result[0].item.id).toBe('item-2');
    });
  });

  describe('state mapping', () => {
    it('exposes FAILED state directly on the returned item', async () => {
      const item = makeItem({ state: 'FAILED', dueDate: new Date('2025-01-08T00:00:00.000Z') });
      const booking = makeBooking({ checklistItems: [item] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result[0].item.state).toBe('FAILED');
    });

    it('exposes PENDING state directly on the returned item', async () => {
      const item = makeItem({ state: 'PENDING', dueDate: new Date('2025-01-08T00:00:00.000Z') });
      const booking = makeBooking({ checklistItems: [item] });
      prisma.booking.findMany.mockResolvedValue([booking]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result[0].item.state).toBe('PENDING');
    });
  });

  describe('multi-step goal active-step surfacing (ADR-0057)', () => {
    // A contract goal: created + sent, due within window, on a CONFIRMED booking.
    const contractGoal = (steps: Array<{ key: string; state: string; completedBy: string; order: number }>) => ({
      id: 'g-contract',
      key: 'get_contract_signed',
      label: 'Get the contract signed',
      state: 'PENDING',
      dueDate: new Date('2025-01-08T00:00:00.000Z'),
      requiredForStatus: 'CONFIRMED',
      order: 0,
      steps,
    });

    it('omits the goal while its active step awaits the client (CUSTOMER signing)', async () => {
      const goal = contractGoal([
        { key: 'create_contract', state: 'COMPLETE', completedBy: 'USER', order: 1 },
        { key: 'send_contract', state: 'COMPLETE', completedBy: 'USER', order: 2 },
        { key: 'contract_signed', state: 'PENDING', completedBy: 'CUSTOMER', order: 3 },
      ]);
      prisma.booking.findMany.mockResolvedValue([makeBooking({ status: 'CONFIRMED', checklistItems: [goal] })]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(0);
    });

    it('surfaces the active step (relabelled) while it is the musician’s to act on', async () => {
      const goal = contractGoal([
        { key: 'create_contract', state: 'COMPLETE', completedBy: 'USER', order: 1 },
        { key: 'send_contract', state: 'PENDING', completedBy: 'USER', order: 2 },
        { key: 'contract_signed', state: 'PENDING', completedBy: 'CUSTOMER', order: 3 },
      ]);
      // The step's own label rides through so the dashboard shows the concrete next action.
      goal.steps[1] = { ...goal.steps[1], label: 'Send it to the client' } as never;
      prisma.booking.findMany.mockResolvedValue([makeBooking({ status: 'CONFIRMED', checklistItems: [goal] })]);

      const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

      expect(result).toHaveLength(1);
      expect(result[0].item).toMatchObject({ key: 'send_contract', label: 'Send it to the client' });
    });
  });

  it('includes booking metadata alongside the item', async () => {
    const item = makeItem({ dueDate: new Date('2025-01-08T00:00:00.000Z') });
    const booking = makeBooking({
      id: 'b-42',
      date: new Date('2025-01-20T19:00:00.000Z'),
      title: 'The Big Gig',
      customer: { name: 'Jane Doe' },
      venue: { name: 'The Venue' },
      checklistItems: [item],
    });
    prisma.booking.findMany.mockResolvedValue([booking]);

    const result = await repo.findActionItems('u1', TODAY, REMINDER_LEAD_DAYS);

    expect(result[0].booking).toMatchObject({
      id: 'b-42',
      title: 'The Big Gig',
      customer: { name: 'Jane Doe' },
      venue: { name: 'The Venue' },
    });
  });
});

describe('ChecklistRepository — findItemByKey', () => {
  let repo: ChecklistRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new ChecklistRepository(prisma as unknown as PrismaService);
  });

  it('looks up an item by booking + key, selecting id and state', async () => {
    prisma.bookingChecklistItem.findFirst.mockResolvedValue({ id: 'ci9', state: 'SKIPPED' });
    const result = await repo.findItemByKey('b1', 'add_venue');
    expect(prisma.bookingChecklistItem.findFirst).toHaveBeenCalledWith({
      where: { bookingId: 'b1', key: 'add_venue' },
      select: { id: true, state: true },
    });
    expect(result).toEqual({ id: 'ci9', state: 'SKIPPED' });
  });
});

describe('ChecklistRepository — seedReminderItem (Module 4)', () => {
  let repo: ChecklistRepository;
  let prisma: MockPrisma;
  const BOOKING_DATE = new Date('2025-06-01T19:00:00.000Z');
  const CREATED_AT = new Date('2025-01-01T00:00:00.000Z');

  beforeEach(() => {
    prisma = makePrisma();
    repo = new ChecklistRepository(prisma as unknown as PrismaService);
    // $transaction(callback) runs the callback with the same mock as the tx client.
    prisma.$transaction.mockImplementation((cb: (tx: MockPrisma) => unknown) => cb(prisma));
  });

  it('is idempotent — returns the existing item without inserting when the key is present', async () => {
    prisma.bookingChecklistItem.findFirst.mockResolvedValue({ id: 'existing', key: 'add_venue' });

    const result = await repo.seedReminderItem('u1', 'b1', 'add_venue', BOOKING_DATE, CREATED_AT);

    expect(result).toEqual({ id: 'existing', key: 'add_venue' });
    expect(prisma.bookingChecklistItem.create).not.toHaveBeenCalled();
    expect(prisma.bookingChecklistItem.updateMany).not.toHaveBeenCalled();
  });

  it('throws for an unknown reminder key', async () => {
    prisma.bookingChecklistItem.findFirst.mockResolvedValue(null);
    await expect(
      repo.seedReminderItem('u1', 'b1', 'not_a_key', BOOKING_DATE, CREATED_AT),
    ).rejects.toThrow('Unknown reminder key: not_a_key');
  });

  it('inserts in template position and shifts the tail by +1', async () => {
    prisma.bookingChecklistItem.findFirst.mockResolvedValue(null);
    // A booking that only has a later-template item (create_balance_invoice, order 1).
    prisma.bookingChecklistItem.findMany.mockResolvedValue([
      { key: 'create_balance_invoice', order: 1 },
    ]);
    prisma.bookingChecklistItem.create.mockResolvedValue({ id: 'new', key: 'confirm_quote', order: 1 });

    await repo.seedReminderItem('u1', 'b1', 'confirm_quote', BOOKING_DATE, CREATED_AT);

    // confirm_quote precedes create_balance_invoice → inserted at order 1, tail shifted.
    expect(prisma.bookingChecklistItem.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'b1', order: { gte: 1 } },
      data: { order: { increment: 1 } },
    });
    const createArg = prisma.bookingChecklistItem.create.mock.calls[0][0];
    expect(createArg.data).toMatchObject({ key: 'confirm_quote', order: 1, bookingId: 'b1', userId: 'u1' });
  });

  it('seeds a dependent item as BLOCKED and computes its due date from the rule', async () => {
    prisma.bookingChecklistItem.findFirst.mockResolvedValue(null);
    prisma.bookingChecklistItem.findMany.mockResolvedValue([]);
    prisma.bookingChecklistItem.create.mockResolvedValue({ id: 'new' });

    // send_thank_you dependsOn play_the_gig, dueDateRule bookingDate +7. (The old song_requests
    // dependent retired with the goal⊃step fold — its invite→response order is intrinsic now.)
    await repo.seedReminderItem('u1', 'b1', 'send_thank_you', BOOKING_DATE, CREATED_AT);

    const createArg = prisma.bookingChecklistItem.create.mock.calls[0][0];
    expect(createArg.data.state).toBe('BLOCKED');
    expect(createArg.data.dueDate).toEqual(new Date('2025-06-08T19:00:00.000Z')); // +7 days
  });
});

describe('ChecklistRepository — resetItemByKey (void un-stick, ADR-0057 / #608)', () => {
  let repo: ChecklistRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new ChecklistRepository(prisma as unknown as PrismaService);
    prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops));
  });

  it('un-sticks a flat goal-level key (un-migrated booking)', async () => {
    prisma.bookingChecklistStep.findFirst.mockResolvedValue(null);

    await repo.resetItemByKey('b1', 'create_balance_invoice');

    expect(prisma.bookingChecklistItem.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'b1', key: 'create_balance_invoice', state: 'COMPLETE' },
      data: { state: 'PENDING', completedAt: null },
    });
    // No step → no transaction.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('un-sticks a step + its parent goal so evaluate() can re-roll-up (migrated booking)', async () => {
    // A migrated booking carries create_deposit_invoice as a COMPLETE step of get_deposit_paid.
    prisma.bookingChecklistStep.findFirst.mockResolvedValue({ id: 'step-1', goalId: 'goal-1' });

    await repo.resetItemByKey('b1', 'create_deposit_invoice');

    expect(prisma.bookingChecklistStep.findFirst).toHaveBeenCalledWith({
      where: { key: 'create_deposit_invoice', state: 'COMPLETE', goal: { bookingId: 'b1' } },
      select: { id: true, goalId: true },
    });
    // The step reset and the goal reset land together in one transaction.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.bookingChecklistStep.update).toHaveBeenCalledWith({
      where: { id: 'step-1' },
      data: { state: 'PENDING', completedAt: null },
    });
    // Only a COMPLETE goal is un-stuck (a SKIPPED opt-out stays skipped).
    expect(prisma.bookingChecklistItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'goal-1', state: 'COMPLETE' },
      data: { state: 'PENDING', completedAt: null },
    });
  });
});

describe('ChecklistRepository — seedChecklistItems (goal⊃step seeding, ADR-0057)', () => {
  let repo: ChecklistRepository;
  let prisma: MockPrisma;
  const BOOKING_DATE = new Date('2025-06-01T19:00:00.000Z');
  const CREATED_AT = new Date('2025-01-01T00:00:00.000Z');

  beforeEach(() => {
    prisma = makePrisma();
    repo = new ChecklistRepository(prisma as unknown as PrismaService);
  });

  it('materialises the contract goal with its canonical create→send→signed steps', async () => {
    prisma.bookingChecklistItem.create.mockResolvedValue({ id: 'g' });

    await repo.seedChecklistItems(
      'u1',
      'b1',
      [{ key: 'get_contract_signed', label: 'Get the contract signed', completedBy: 'USER', requiredForStatus: 'CONFIRMED', autoCompleteRule: null, dependsOn: [], dueDateRule: { basis: 'bookingDate', offsetDays: -60 } }],
      BOOKING_DATE,
      CREATED_AT,
    );

    const createArg = prisma.bookingChecklistItem.create.mock.calls[0][0];
    expect(createArg.data).toMatchObject({ key: 'get_contract_signed', state: 'PENDING', bookingId: 'b1', userId: 'u1' });
    const stepKeys = createArg.data.steps.create.map((s: { key: string }) => s.key);
    expect(stepKeys).toEqual(['create_contract', 'send_contract', 'contract_signed']);
    const signed = createArg.data.steps.create.find((s: { key: string }) => s.key === 'contract_signed');
    expect(signed).toMatchObject({ completeMode: 'AWAITED', completedBy: 'CUSTOMER', state: 'PENDING', order: 3 });
    // Backend owns step structure: steps come from canonical defaults, not the payload.
    expect(prisma.bookingChecklistItem.createMany).not.toHaveBeenCalled();
  });

  it('batches stepless goals via createMany while a stepped goal keeps template order', async () => {
    prisma.bookingChecklistItem.create.mockResolvedValue({ id: 'g' });

    await repo.seedChecklistItems(
      'u1',
      'b1',
      [
        { key: 'send_quote', label: 'Send quote', completedBy: 'USER', requiredForStatus: 'PROVISIONAL', autoCompleteRule: { type: 'communicationSent', templateTypes: ['quote'] }, dependsOn: [] },
        { key: 'get_contract_signed', label: 'Get the contract signed', completedBy: 'USER', requiredForStatus: 'CONFIRMED', autoCompleteRule: null, dependsOn: [] },
      ],
      BOOKING_DATE,
      CREATED_AT,
    );

    const batched = prisma.bookingChecklistItem.createMany.mock.calls[0][0].data;
    expect(batched).toEqual([expect.objectContaining({ key: 'send_quote', order: 1 })]);
    const createdGoal = prisma.bookingChecklistItem.create.mock.calls[0][0].data;
    expect(createdGoal).toMatchObject({ key: 'get_contract_signed', order: 2 });
  });
});
