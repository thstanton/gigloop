import { SeriesRepository } from './series.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  booking: { findMany: jest.Mock };
};

function makePrisma(): MockPrisma {
  return {
    booking: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('SeriesRepository', () => {
  let prisma: MockPrisma;
  let repo: SeriesRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new SeriesRepository(prisma as unknown as PrismaService);
  });

  // #850 (ADR-0043's 2026-08-18 amendment): a CANCELLED member is excluded from a series
  // invoice — billing a cancelled gig is the over-bill this exclusion exists to kill.
  describe('findMemberBookingsForInvoice', () => {
    it('excludes CANCELLED bookings from the series membership scoped to this user', async () => {
      await repo.findMemberBookingsForInvoice('u1', 's1');
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { seriesId: 's1', userId: 'u1', status: { not: 'CANCELLED' } },
        }),
      );
    });
  });
});
