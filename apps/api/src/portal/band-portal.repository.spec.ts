import { BandPortalRepository } from './band-portal.repository';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  return {
    bookingBandMember: {
      updateMany: jest.fn(),
    },
  };
}

describe('BandPortalRepository.respondToInvite', () => {
  it('guards the update with a status `where`, so it only matches a still-respondable member', async () => {
    const prisma = makePrisma();
    prisma.bookingBandMember.updateMany.mockResolvedValue({ count: 1 });
    const repo = new BandPortalRepository(prisma as unknown as PrismaService);

    const responded = await repo.respondToInvite('member-1', 'CONFIRMED');

    expect(prisma.bookingBandMember.updateMany).toHaveBeenCalledWith({
      where: { id: 'member-1', status: { in: ['ADDED', 'INVITED'] } },
      data: { status: 'CONFIRMED', respondedAt: expect.any(Date) },
    });
    expect(responded).toBe(true);
  });

  it('reports no match when the row is no longer respondable (a concurrent responder won the race)', async () => {
    const prisma = makePrisma();
    prisma.bookingBandMember.updateMany.mockResolvedValue({ count: 0 });
    const repo = new BandPortalRepository(prisma as unknown as PrismaService);

    const responded = await repo.respondToInvite('member-1', 'DECLINED');

    expect(responded).toBe(false);
  });
});
