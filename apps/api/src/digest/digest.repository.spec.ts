import { DigestRepository } from './digest.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  userProfile: { findMany: jest.Mock };
  publicProfile: { findMany: jest.Mock };
  booking: { findMany: jest.Mock };
};

function makePrisma(): MockPrisma {
  return {
    userProfile: { findMany: jest.fn() },
    publicProfile: { findMany: jest.fn() },
    booking: { findMany: jest.fn() },
  };
}

// monday 2025-01-06
const WEEK_START = new Date('2025-01-06T00:00:00.000Z');
// sunday 2025-01-12
const WEEK_END = new Date('2025-01-12T23:59:59.999Z');
const TODAY = new Date('2025-01-06T00:00:00.000Z');
const REMINDER_LEAD_DAYS = 7;

function makeItem(overrides: Partial<{
  id: string;
  bookingId: string;
  label: string;
  state: string;
  completedBy: string;
  dueDate: Date | null;
  requiredForStatus: string | null;
  order: number;
}> = {}) {
  return {
    id: 'item-1',
    bookingId: 'booking-1',
    label: 'Test item',
    state: 'PENDING',
    completedBy: 'USER',
    dueDate: null,
    requiredForStatus: null,
    order: 0,
    ...overrides,
  };
}

function makeBooking(overrides: Partial<{
  id: string;
  userId: string;
  date: Date;
  title: string | null;
  eventType: string;
  status: string;
  customer: { name: string };
  venue: { name: string } | null;
  checklistItems: ReturnType<typeof makeItem>[];
}> = {}) {
  return {
    id: 'booking-1',
    userId: 'user-1',
    date: new Date('2025-01-20T19:00:00.000Z'),
    title: 'Wedding',
    eventType: 'Wedding',
    status: 'CONFIRMED',
    customer: { name: 'Alice Smith' },
    venue: null,
    checklistItems: [],
    ...overrides,
  };
}

describe('DigestRepository', () => {
  let repo: DigestRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new DigestRepository(prisma as unknown as PrismaService);
  });

  describe('findUsersWithDigestEnabled', () => {
    it('returns users with digest enabled joined to their public profile', async () => {
      prisma.userProfile.findMany.mockResolvedValue([
        { userId: 'u1', preferences: { reminderLeadDays: 5 } },
      ]);
      prisma.publicProfile.findMany.mockResolvedValue([
        { userId: 'u1', email: 'u1@example.com' },
      ]);

      const result = await repo.findUsersWithDigestEnabled();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'u1',
        preferences: { reminderLeadDays: 5 },
        publicProfile: { userId: 'u1', email: 'u1@example.com' },
      });
    });

    it('sets publicProfile to null when no public profile exists', async () => {
      prisma.userProfile.findMany.mockResolvedValue([
        { userId: 'u2', preferences: {} },
      ]);
      prisma.publicProfile.findMany.mockResolvedValue([]);

      const result = await repo.findUsersWithDigestEnabled();

      expect(result[0].publicProfile).toBeNull();
    });

    it('returns empty array when no users have digest enabled', async () => {
      prisma.userProfile.findMany.mockResolvedValue([]);
      prisma.publicProfile.findMany.mockResolvedValue([]);

      const result = await repo.findUsersWithDigestEnabled();

      expect(result).toHaveLength(0);
    });
  });

  describe('findDigestDataForUser — gigsThisWeek', () => {
    beforeEach(() => {
      // default: no upcoming items
      prisma.booking.findMany
        .mockResolvedValueOnce([]) // gigsThisWeek
        .mockResolvedValueOnce([]); // upcomingBookings
    });

    it('returns gigsThisWeek from first booking query', async () => {
      const gig = makeBooking();
      prisma.booking.findMany
        .mockReset()
        .mockResolvedValueOnce([gig])
        .mockResolvedValueOnce([]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.gigsThisWeek).toHaveLength(1);
      expect(result.gigsThisWeek[0].id).toBe('booking-1');
    });
  });

  describe('findDigestDataForUser — surfacing rule 1: dated items', () => {
    it('surfaces a dated item whose dueDate is within the lead window', async () => {
      const item = makeItem({ dueDate: new Date('2025-01-10T00:00:00.000Z') }); // today+4
      const booking = makeBooking({ checklistItems: [item] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems).toHaveLength(1);
      expect(result.upcomingItems[0].items[0].id).toBe('item-1');
    });

    it('does not surface a dated item whose dueDate is beyond the lead window', async () => {
      const item = makeItem({ dueDate: new Date('2025-01-20T00:00:00.000Z') }); // today+14
      const booking = makeBooking({ checklistItems: [item] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems).toHaveLength(0);
    });

    it('surfaces a dated item whose dueDate equals exactly the cutoff', async () => {
      // cutoff = today + 7 = 2025-01-13
      const item = makeItem({ dueDate: new Date('2025-01-13T00:00:00.000Z') });
      const booking = makeBooking({ checklistItems: [item] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems[0].items).toHaveLength(1);
    });
  });

  describe('findDigestDataForUser — surfacing rule 2: undated status-gate items', () => {
    it('surfaces an undated status-gate item when it is the only blocker for that status', async () => {
      const item = makeItem({ requiredForStatus: 'CONFIRMED' });
      const booking = makeBooking({ checklistItems: [item] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems[0].items).toHaveLength(1);
    });

    it('does not surface an undated status-gate item when other blockers for the same status exist', async () => {
      const item1 = makeItem({ id: 'item-1', requiredForStatus: 'CONFIRMED' });
      const item2 = makeItem({ id: 'item-2', requiredForStatus: 'CONFIRMED', order: 1 });
      const booking = makeBooking({ checklistItems: [item1, item2] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems).toHaveLength(0);
    });

    it('does not surface an undated item with no requiredForStatus', async () => {
      const item = makeItem({ dueDate: null, requiredForStatus: null });
      const booking = makeBooking({ checklistItems: [item] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems).toHaveLength(0);
    });

    it('surfaces status-gate items independently per requiredForStatus value', async () => {
      // 2 different requiredForStatus values, one item each → both surface
      const item1 = makeItem({ id: 'item-1', requiredForStatus: 'CONFIRMED' });
      const item2 = makeItem({ id: 'item-2', requiredForStatus: 'READY', order: 1 });
      const booking = makeBooking({ checklistItems: [item1, item2] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems[0].items).toHaveLength(2);
    });
  });

  describe('findDigestDataForUser — edge cases', () => {
    it('returns empty upcomingItems when all bookings have no surfaceable items', async () => {
      const item = makeItem({ dueDate: null, requiredForStatus: null });
      const booking = makeBooking({ checklistItems: [item] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems).toHaveLength(0);
    });

    it('returns empty upcomingItems when no upcoming bookings exist', async () => {
      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems).toHaveLength(0);
    });

    it('handles a mix of surfaceable and non-surfaceable items on the same booking', async () => {
      const surfaceable = makeItem({ id: 'item-1', dueDate: new Date('2025-01-08T00:00:00.000Z') });
      const notSurfaceable = makeItem({ id: 'item-2', dueDate: null, requiredForStatus: null, order: 1 });
      const booking = makeBooking({ checklistItems: [surfaceable, notSurfaceable] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems[0].items).toHaveLength(1);
      expect(result.upcomingItems[0].items[0].id).toBe('item-1');
    });

    it('excludes bookings with no items at all from upcomingItems', async () => {
      const booking = makeBooking({ checklistItems: [] });

      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([booking]);

      const result = await repo.findDigestDataForUser('u1', WEEK_START, WEEK_END, TODAY, REMINDER_LEAD_DAYS);

      expect(result.upcomingItems).toHaveLength(0);
    });
  });
});
