import { DigestService } from './digest.service';
import { DigestRepository } from './digest.repository';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

// Monday 2025-01-06 07:00 UTC (cron fire time)
const MONDAY = new Date('2025-01-06T07:00:00.000Z');

// Helpers
function makeUserProfile(overrides: Partial<{
  userId: string;
  preferences: Record<string, unknown>;
  publicProfile: { userId: string; email: string | null } | null;
}> = {}) {
  return {
    userId: 'user-1',
    preferences: {},
    publicProfile: { userId: 'user-1', email: 'musician@example.com' },
    ...overrides,
  };
}

function makeGig(overrides: Partial<{ id: string; date: Date; customer: { name: string }; venue: { name: string } | null }> = {}) {
  return {
    id: 'booking-1',
    userId: 'user-1',
    date: new Date('2025-01-08T19:00:00.000Z'),
    title: null,
    eventType: 'Wedding',
    status: 'CONFIRMED',
    customer: { name: 'Alice Smith' },
    venue: null,
    ...overrides,
  };
}

function makeActionBooking(items: Array<{ id: string; label: string; dueDate: Date | null }>, bookingOverrides = {}) {
  return {
    booking: {
      id: 'booking-2',
      userId: 'user-1',
      date: new Date('2025-01-20T19:00:00.000Z'),
      title: 'Corporate Event',
      eventType: 'Corporate',
      status: 'CONFIRMED',
      customer: { name: 'Bob Corp' },
      venue: null,
      ...bookingOverrides,
    },
    items: items.map((i) => ({
      id: i.id,
      bookingId: 'booking-2',
      label: i.label,
      state: 'PENDING',
      completedBy: 'USER',
      dueDate: i.dueDate,
      requiredForStatus: null,
      order: 0,
    })),
  };
}

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

function makeMailService() {
  return { sendBatch: jest.fn().mockResolvedValue(undefined) } as unknown as MailService;
}

describe('DigestService (integration)', () => {
  let service: DigestService;
  let prisma: MockPrisma;
  let mail: MailService;
  let repo: DigestRepository;

  beforeEach(() => {
    prisma = makePrisma();
    mail = makeMailService();
    repo = new DigestRepository(prisma as unknown as PrismaService);
    service = new DigestService(repo, mail);
  });

  describe('user targeting', () => {
    it('sends to users with digest enabled', async () => {
      const user = makeUserProfile();
      prisma.userProfile.findMany.mockResolvedValue([{ userId: user.userId, preferences: user.preferences }]);
      prisma.publicProfile.findMany.mockResolvedValue([user.publicProfile]);
      prisma.booking.findMany
        .mockResolvedValueOnce([makeGig()]) // gigsThisWeek
        .mockResolvedValueOnce([]);          // upcomingBookings

      await service.sendWeeklyDigest(MONDAY);

      expect(mail.sendBatch).toHaveBeenCalledTimes(1);
      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails[0].to).toBe('musician@example.com');
    });

    it('skips users with no email on their public profile', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: null }]);

      await service.sendWeeklyDigest(MONDAY);

      expect(mail.sendBatch).toHaveBeenCalledWith([]);
    });

    it('batches all emails in a single sendBatch call', async () => {
      prisma.userProfile.findMany.mockResolvedValue([
        { userId: 'u1', preferences: {} },
        { userId: 'u2', preferences: {} },
      ]);
      prisma.publicProfile.findMany.mockResolvedValue([
        { userId: 'u1', email: 'u1@example.com' },
        { userId: 'u2', email: 'u2@example.com' },
      ]);
      // u1: has a gig, u2: has a gig
      prisma.booking.findMany
        .mockResolvedValueOnce([makeGig()]) // u1 gigsThisWeek
        .mockResolvedValueOnce([])          // u1 upcomingBookings
        .mockResolvedValueOnce([makeGig()]) // u2 gigsThisWeek
        .mockResolvedValueOnce([]);          // u2 upcomingBookings

      await service.sendWeeklyDigest(MONDAY);

      expect(mail.sendBatch).toHaveBeenCalledTimes(1);
      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails).toHaveLength(2);
    });
  });

  describe('skip when both sections empty', () => {
    it('does not include user email when no gigs and no surfaceable items', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([]) // no gigs this week
        .mockResolvedValueOnce([]); // no upcoming bookings with items

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails).toHaveLength(0);
    });
  });

  describe('subject line', () => {
    it('uses booking count when there are gigs this week', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([makeGig(), makeGig({ id: 'booking-3' })])
        .mockResolvedValueOnce([]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails[0].subject).toBe('Your week ahead: 2 bookings');
    });

    it('uses singular "booking" for exactly one gig', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([makeGig()])
        .mockResolvedValueOnce([]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails[0].subject).toBe('Your week ahead: 1 booking');
    });

    it('uses plain subject when no gigs but has action items', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      const actionItem = makeActionBooking([{ id: 'i1', label: 'Send contract', dueDate: new Date('2025-01-08T00:00:00.000Z') }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([]) // no gigs
        .mockResolvedValueOnce([{ ...actionItem.booking, checklistItems: actionItem.items }]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails[0].subject).toBe('Your week ahead');
    });
  });

  describe('item surfacing in full pipeline', () => {
    it('surfaces a dated item within the default 7-day lead window', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      const dueSoon = makeActionBooking([{ id: 'i1', label: 'Send contract', dueDate: new Date('2025-01-10T00:00:00.000Z') }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...dueSoon.booking, checklistItems: dueSoon.items }]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails).toHaveLength(1);
      expect(emails[0].body).toContain('Send contract');
    });

    it('does not surface a dated item outside the lead window', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      const farFuture = makeActionBooking([{ id: 'i1', label: 'Collect fee', dueDate: new Date('2025-02-01T00:00:00.000Z') }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...farFuture.booking, checklistItems: farFuture.items }]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails).toHaveLength(0);
    });

    it('respects custom reminderLeadDays from user preferences', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: { reminderLeadDays: 3 } }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      // dueDate = today+5 → outside 3-day window
      const justMissed = makeActionBooking([{ id: 'i1', label: 'Call venue', dueDate: new Date('2025-01-11T00:00:00.000Z') }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...justMissed.booking, checklistItems: justMissed.items }]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails).toHaveLength(0);
    });
  });

  describe('email HTML content', () => {
    it('includes gig customer name and booking link', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([makeGig({ id: 'bk-abc', customer: { name: 'Groom & Bride' } })])
        .mockResolvedValueOnce([]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails[0].body).toContain('Groom &amp; Bride');
      expect(emails[0].body).toContain('/admin/bookings/bk-abc');
    });

    it('shows "overdue" label for past-due items', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      // dueDate before MONDAY (today)
      const overdueItem = makeActionBooking([{ id: 'i1', label: 'Sign contract', dueDate: new Date('2025-01-03T00:00:00.000Z') }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...overdueItem.booking, checklistItems: overdueItem.items }]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails[0].body).toContain('Sign contract — overdue');
    });

    it('shows day of week for items due this week', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      // dueDate = Thursday 2025-01-09
      const thisWeek = makeActionBooking([{ id: 'i1', label: 'Send invoice', dueDate: new Date('2025-01-09T00:00:00.000Z') }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ ...thisWeek.booking, checklistItems: thisWeek.items }]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails[0].body).toContain('Send invoice — Thursday');
    });

    it('includes both sections in every email', async () => {
      prisma.userProfile.findMany.mockResolvedValue([{ userId: 'u1', preferences: {} }]);
      prisma.publicProfile.findMany.mockResolvedValue([{ userId: 'u1', email: 'u1@example.com' }]);
      prisma.booking.findMany
        .mockResolvedValueOnce([makeGig()])
        .mockResolvedValueOnce([]);

      await service.sendWeeklyDigest(MONDAY);

      const [emails] = (mail.sendBatch as jest.Mock).mock.calls[0];
      expect(emails[0].body).toContain('Gigs this week');
      expect(emails[0].body).toContain('Actions');
      expect(emails[0].body).toContain("You're all caught up!");
    });
  });
});
