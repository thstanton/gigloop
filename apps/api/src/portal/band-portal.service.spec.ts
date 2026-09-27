import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BandPortalService } from './band-portal.service';
import { BandPortalRepository } from './band-portal.repository';
import { PublicProfileRepository } from '../user-profile/public-profile.repository';

function makeService(overrides?: {
  member?: unknown;
  booking?: unknown;
  publicProfile?: unknown;
}) {
  const repo = {
    findMemberByToken: jest.fn().mockResolvedValue(
      overrides?.member !== undefined
        ? overrides.member
        : { id: 'member-1', bookingId: 'booking-1', status: 'CONFIRMED', sessionFee: '150.00' },
    ),
    respondToInvite: jest.fn().mockResolvedValue(true),
    findBookingForBandPortal: jest.fn().mockResolvedValue(
      overrides?.booking !== undefined
        ? overrides.booking
        : {
            title: 'The Hartley Wedding',
            date: new Date('2027-06-12T00:00:00Z'),
            status: 'CONFIRMED',
            logistics: null,
            userId: 'user-1',
            venue: null,
            sets: [],
            packages: [],
            lineups: [],
            bandChairs: [
              { id: 'chair-1', role: 'Sax', lineupId: 'l1', memberId: 'member-1', member: { contact: { name: 'Dave' } } },
              { id: 'chair-2', role: 'Bass', lineupId: 'l1', memberId: null, member: null },
            ],
          },
    ),
  } as unknown as BandPortalRepository;

  const publicProfileRepo = {
    findByUserId: jest.fn().mockResolvedValue(
      overrides?.publicProfile !== undefined
        ? overrides.publicProfile
        : {
            businessName: 'Test Musician',
            displayName: null,
            email: 'musician@example.com',
            phone: '+44 7700 900000',
            logoUrl: null,
            clientPortalConfig: { brandColour: '#123456', theme: 'BOLD_MODERN' },
          },
    ),
  } as unknown as PublicProfileRepository;

  return new BandPortalService(repo, publicProfileRepo);
}

describe('BandPortalService.getBandPortalData', () => {
  it('404s for an unknown token', async () => {
    const service = makeService({ member: null });
    await expect(service.getBandPortalData('bad-token')).rejects.toThrow(NotFoundException);
  });

  it('404s for a removed member (the repository already excludes removedAt rows)', async () => {
    // findMemberByToken's `where: { removedAt: null }` means a removed member's token resolves to
    // null exactly like an unknown one — asserting the null case covers both (ADR-0072 §5).
    const service = makeService({ member: null });
    await expect(service.getBandPortalData('removed-token')).rejects.toThrow(NotFoundException);
  });

  it('returns the cancelled variant, with branding only, when the booking is cancelled', async () => {
    const service = makeService({ booking: { title: 'x', date: new Date(), status: 'CANCELLED', logistics: null, userId: 'user-1', venue: null, sets: [], packages: [], lineups: [], bandChairs: [] } });
    const result = await service.getBandPortalData('token');
    expect(result).toEqual({
      cancelled: true,
      branding: expect.objectContaining({ businessName: 'Test Musician' }),
    });
    expect(result).not.toHaveProperty('roster');
    expect(result).not.toHaveProperty('self');
  });

  it('builds the roster and self views from the token member and booking on the happy path', async () => {
    const service = makeService();
    const result = await service.getBandPortalData('token');
    if (result.cancelled) throw new Error('expected the non-cancelled branch');

    expect(result.branding).toEqual({
      businessName: 'Test Musician',
      displayName: null,
      logoUrl: null,
      brandColour: '#123456',
      portalTheme: 'BOLD_MODERN',
      email: 'musician@example.com',
      phone: '+44 7700 900000',
    });
    expect(result.self).toEqual({ status: 'CONFIRMED', sessionFee: '150.00', ownChairIds: ['chair-1'] });
    expect(result.roster.chairs).toEqual([
      { id: 'chair-1', role: 'Sax', memberName: 'Dave', callTimes: [] },
      { id: 'chair-2', role: 'Bass', memberName: null, callTimes: [] },
    ]);
  });

  it('404s when the booking behind the token has vanished', async () => {
    const service = makeService({ booking: null });
    await expect(service.getBandPortalData('token')).rejects.toThrow(NotFoundException);
  });

  it('404s when the organiser has no public profile yet', async () => {
    const service = makeService({ publicProfile: null });
    await expect(service.getBandPortalData('token')).rejects.toThrow(NotFoundException);
  });
});

describe('BandPortalService.respondToInvite', () => {
  it('404s for an unknown token', async () => {
    const service = makeService({ member: null });
    await expect(service.respondToInvite('bad-token', 'CONFIRMED')).rejects.toThrow(NotFoundException);
  });

  it('confirms from ADDED, stamps the mutation, and re-reads the fresh view for the response', async () => {
    const service = makeService({ member: { id: 'member-1', bookingId: 'booking-1', status: 'ADDED', sessionFee: null } });
    const repo = (service as unknown as { repo: BandPortalRepository }).repo;
    // The mock findMemberByToken can't see its own mutation, so simulate the fresh re-read
    // (`getBandPortalData`'s own call, after `respondToInvite` has persisted CONFIRMED) explicitly.
    (repo.findMemberByToken as jest.Mock).mockResolvedValueOnce({ id: 'member-1', bookingId: 'booking-1', status: 'ADDED', sessionFee: null });
    (repo.findMemberByToken as jest.Mock).mockResolvedValueOnce({ id: 'member-1', bookingId: 'booking-1', status: 'CONFIRMED', sessionFee: null });

    const result = await service.respondToInvite('token', 'CONFIRMED');
    expect(repo.respondToInvite).toHaveBeenCalledWith('member-1', 'CONFIRMED');
    if (result.cancelled) throw new Error('expected the non-cancelled branch');
    expect(result.self.status).toBe('CONFIRMED');
  });

  it('declines from INVITED', async () => {
    const service = makeService({ member: { id: 'member-1', bookingId: 'booking-1', status: 'INVITED', sessionFee: null } });
    await service.respondToInvite('token', 'DECLINED');
    const repo = (service as unknown as { repo: BandPortalRepository }).repo;
    expect(repo.respondToInvite).toHaveBeenCalledWith('member-1', 'DECLINED');
  });

  it('rejects a second response server-side once already CONFIRMED', async () => {
    const service = makeService({ member: { id: 'member-1', bookingId: 'booking-1', status: 'CONFIRMED', sessionFee: null } });
    await expect(service.respondToInvite('token', 'DECLINED')).rejects.toThrow(BadRequestException);
    const repo = (service as unknown as { repo: BandPortalRepository }).repo;
    expect(repo.respondToInvite).not.toHaveBeenCalled();
  });

  it('rejects a second response server-side once already DECLINED', async () => {
    const service = makeService({ member: { id: 'member-1', bookingId: 'booking-1', status: 'DECLINED', sessionFee: null } });
    await expect(service.respondToInvite('token', 'CONFIRMED')).rejects.toThrow(BadRequestException);
  });

  it('rejects a response that loses the race — the atomic repo update matched 0 rows', async () => {
    // The read-then-check above saw ADDED (a concurrent responder got there first, between the
    // read and the write), but the repo's own status-guarded updateMany is what actually enforces
    // one-shot: it reports back that nothing matched.
    const service = makeService({ member: { id: 'member-1', bookingId: 'booking-1', status: 'ADDED', sessionFee: null } });
    const repo = (service as unknown as { repo: BandPortalRepository }).repo;
    (repo.respondToInvite as jest.Mock).mockResolvedValueOnce(false);
    await expect(service.respondToInvite('token', 'CONFIRMED')).rejects.toThrow(BadRequestException);
  });

  it('rejects responding once the booking is cancelled', async () => {
    const service = makeService({
      member: { id: 'member-1', bookingId: 'booking-1', status: 'ADDED', sessionFee: null },
      booking: { title: 'x', date: new Date(), status: 'CANCELLED', logistics: null, userId: 'user-1', venue: null, sets: [], packages: [], lineups: [], bandChairs: [] },
    });
    await expect(service.respondToInvite('token', 'CONFIRMED')).rejects.toThrow(BadRequestException);
    const repo = (service as unknown as { repo: BandPortalRepository }).repo;
    expect(repo.respondToInvite).not.toHaveBeenCalled();
  });
});
