import { CommunicationsRepository } from './communications.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  booking: { findFirst: jest.Mock };
  communication: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
};

function makePrisma(): MockPrisma {
  return {
    booking: { findFirst: jest.fn() },
    communication: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
}

describe('CommunicationsRepository', () => {
  let repo: CommunicationsRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new CommunicationsRepository(prisma as unknown as PrismaService);
  });

  // ADR-0080: a series communication belongs to no single booking, so findAll merges it into
  // every member booking's list. The seriesId leg of the OR must only be added when the booking
  // actually has a series — otherwise it matches every communication with a null seriesId, i.e.
  // that user's ENTIRE communication history, on a non-series booking's page.
  describe('findAll — series merge (ADR-0080)', () => {
    it('queries by bookingId alone when the booking has no series', async () => {
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1', seriesId: null });
      prisma.communication.findMany.mockResolvedValue([]);

      await repo.findAll('u1', 'b1');

      expect(prisma.communication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', OR: [{ bookingId: 'b1' }] },
        }),
      );
    });

    it('queries by bookingId alone when the booking does not exist (or is not owned)', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.communication.findMany.mockResolvedValue([]);

      await repo.findAll('u1', 'b1');

      expect(prisma.communication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', OR: [{ bookingId: 'b1' }] },
        }),
      );
    });

    it('adds the seriesId leg only when the booking is a series member', async () => {
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1', seriesId: 's1' });
      prisma.communication.findMany.mockResolvedValue([]);

      await repo.findAll('u1', 'b1');

      expect(prisma.communication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', OR: [{ bookingId: 'b1' }, { seriesId: 's1' }] },
        }),
      );
    });

    it('scopes userId across the whole OR, not one leg — the cross-tenant-leak trap', async () => {
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1', seriesId: 's1' });
      prisma.communication.findMany.mockResolvedValue([]);

      await repo.findAll('u1', 'b1');

      const call = prisma.communication.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe('u1');
      expect(call.where.OR.every((leg: Record<string, unknown>) => !('userId' in leg))).toBe(true);
    });

    it('looks up the booking scoped by userId (never a bare id) before deciding the OR shape', async () => {
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1', seriesId: 's1' });
      prisma.communication.findMany.mockResolvedValue([]);

      await repo.findAll('u1', 'b1');

      expect(prisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b1', userId: 'u1' } }),
      );
    });
  });

  describe('createPendingForSeries', () => {
    it('creates a PENDING communication scoped by seriesId, with no bookingId', async () => {
      prisma.communication.create.mockResolvedValue({ id: 'c1' });

      await repo.createPendingForSeries('u1', 's1', 'ct1', 'Subject', '<p>Body</p>', 'tmpl1', 'doc1');

      expect(prisma.communication.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          seriesId: 's1',
          contactId: 'ct1',
          subject: 'Subject',
          body: '<p>Body</p>',
          status: 'PENDING',
          templateId: 'tmpl1',
          documentId: 'doc1',
        },
      });
    });

    it('omits templateId/documentId from the data payload when not provided', async () => {
      prisma.communication.create.mockResolvedValue({ id: 'c1' });

      await repo.createPendingForSeries('u1', 's1', 'ct1', 'Subject', '<p>Body</p>');

      const { data } = prisma.communication.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('templateId');
      expect(data).not.toHaveProperty('documentId');
      expect(data.bookingId).toBeUndefined();
    });
  });
});
