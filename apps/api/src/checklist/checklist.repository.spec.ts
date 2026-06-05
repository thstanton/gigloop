import { ChecklistRepository } from './checklist.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  booking: { findMany: jest.Mock };
  bookingChecklistItem: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  return {
    booking: { findMany: jest.fn() },
    bookingChecklistItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
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
  customer: { name: string };
  venue: { name: string } | null;
  checklistItems: ReturnType<typeof makeItem>[];
}> = {}) {
  return {
    id: 'booking-1',
    date: new Date('2025-01-20T19:00:00.000Z'),
    title: 'Wedding',
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
