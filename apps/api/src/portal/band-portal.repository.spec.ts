import { BandPortalRepository } from './band-portal.repository';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  const prisma = {
    bookingBandMember: {
      updateMany: jest.fn(),
    },
    bookingBandChair: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) => callback(prisma));
  return prisma;
}

describe('BandPortalRepository.respondToInvite', () => {
  it('guards the update with a status `where`, so it only matches a still-respondable member', async () => {
    const prisma = makePrisma();
    prisma.bookingBandMember.updateMany.mockResolvedValue({ count: 1 });
    const repo = new BandPortalRepository(prisma as unknown as PrismaService);

    const responded = await repo.respondToInvite('user-1', 'booking-1', 'member-1', 'CONFIRMED', false);

    expect(prisma.bookingBandMember.updateMany).toHaveBeenCalledWith({
      where: { id: 'member-1', bookingId: 'booking-1', userId: 'user-1', status: { in: ['ADDED', 'INVITED'] } },
      data: { status: 'CONFIRMED', respondedAt: expect.any(Date) },
    });
    expect(prisma.bookingBandChair.updateMany).not.toHaveBeenCalled();
    expect(responded).toBe(true);
  });

  it('reports no match when the row is no longer respondable (a concurrent responder won the race)', async () => {
    const prisma = makePrisma();
    prisma.bookingBandMember.updateMany.mockResolvedValue({ count: 0 });
    const repo = new BandPortalRepository(prisma as unknown as PrismaService);

    const responded = await repo.respondToInvite('user-1', 'booking-1', 'member-1', 'DECLINED', false);

    expect(responded).toBe(false);
    expect(prisma.bookingBandChair.updateMany).not.toHaveBeenCalled();
  });

  it('vacates the member’s chairs atomically with a DECLINED response', async () => {
    const prisma = makePrisma();
    prisma.bookingBandMember.updateMany.mockResolvedValue({ count: 1 });
    prisma.bookingBandChair.updateMany.mockResolvedValue({ count: 2 });
    const repo = new BandPortalRepository(prisma as unknown as PrismaService);

    const responded = await repo.respondToInvite('user-1', 'booking-1', 'member-1', 'DECLINED', true);

    expect(responded).toBe(true);
    expect(prisma.bookingBandChair.updateMany).toHaveBeenCalledWith({
      where: { memberId: 'member-1', bookingId: 'booking-1', userId: 'user-1' },
      data: { memberId: null },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
