import { BookingStatus } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  booking: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findFirstOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  performanceSet: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
  };
  package: {
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  packageTemplate: {
    findMany: jest.Mock;
  };
  bookingBandChair: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    createMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
    updateMany: jest.Mock;
  };
  bookingBandMember: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  lineup: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
  };
  lineupPackage: {
    create: jest.Mock;
  };
  musicFormConfig: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    booking: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    performanceSet: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    package: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    packageTemplate: {
      findMany: jest.fn(),
    },
    bookingBandChair: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    bookingBandMember: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    lineup: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    lineupPackage: {
      create: jest.fn(),
    },
    musicFormConfig: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    // Callback form runs against the same mock client (the transactional `tx`).
    $transaction: jest.fn((arg) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    ),
  };
  return prisma;
}

describe('BookingsRepository', () => {
  let repo: BookingsRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new BookingsRepository(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('applies no status filter when called with no statuses', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1');
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      // No status key at all — returns every status including CANCELLED
      expect(where.status).toBeUndefined();
    });

    it('applies no status filter when called with an empty array', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1', []);
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.status).toBeUndefined();
    });

    it('filters to a single status when one is provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1', [BookingStatus.CONFIRMED]);
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: [BookingStatus.CONFIRMED] });
    });

    it('filters to multiple statuses when an array is provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      const pipeline = [BookingStatus.ENQUIRY, BookingStatus.PROVISIONAL, BookingStatus.CONFIRMED, BookingStatus.READY];
      await repo.findAll('u1', pipeline);
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: pipeline });
    });

    it('accepts CANCELLED when explicitly requested', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1', [BookingStatus.CANCELLED]);
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: [BookingStatus.CANCELLED] });
    });

    it('scopes query to userId and orders by date asc', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1');
      const call = prisma.booking.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe('u1');
      expect(call.orderBy).toEqual({ date: 'asc' });
    });

    it('passes search query through as AND clauses in the where clause', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1', [], 'smith');
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.AND).toBeDefined();
      expect(where.userId).toBe('u1');
    });

    it('applies eventType equality filter when provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1', [], undefined, 'WEDDING');
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.eventType).toBe('WEDDING');
      expect(where.userId).toBe('u1');
    });

    it('applies no eventType filter when not provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1', []);
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.eventType).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('queries by id and userId with no status filter', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 'b1');
      expect(prisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b1', userId: 'u1' } }),
      );
    });

    it('selects customer, venue, bookingAgent, sets, and packages', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 'b1');
      const select = prisma.booking.findFirst.mock.calls[0][0].select;
      expect(select.customer).toBeDefined();
      expect(select.venue).toBeDefined();
      expect(select.bookingAgent).toBeDefined();
      expect(select.sets).toBeDefined();
      expect(select.packages).toBeDefined();
    });

    // ADR-0071 / #873: the detail query narrows to an explicit `select` (not `include`), so
    // `userId` never ships — at the top level or on any nested contact, set, or package.
    it('uses an explicit select, never include, and excludes userId at every level', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 'b1');
      const call = prisma.booking.findFirst.mock.calls[0][0];
      expect(call.include).toBeUndefined();

      const select = call.select;
      expect(select.userId).toBeUndefined();
      expect(select.customer.select.userId).toBeUndefined();
      expect(select.venue.select.userId).toBeUndefined();
      expect(select.bookingAgent.select.userId).toBeUndefined();
      expect(select.sets.select.userId).toBeUndefined();
      expect(select.packages.select.userId).toBeUndefined();
      expect(select.contracts.select.userId).toBeUndefined();
    });
  });

  describe('findForOwnership', () => {
    it('scopes by id and userId and selects only id + userId (no relation hydration)', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await repo.findForOwnership('u1', 'b1');
      const call = prisma.booking.findFirst.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'b1', userId: 'u1' });
      expect(call.select).toEqual({ id: true, userId: true });
      expect(call.include).toBeUndefined();
    });
  });

  describe('create', () => {
    const baseDto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] };

    it('passes userId and booking fields to Prisma', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      await repo.create('u1', baseDto);
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.userId).toBe('u1');
      expect(data.customerId).toBe('c1');
      expect(data.eventType).toBe('WEDDING');
    });

    it('omits fee from data when not provided', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      await repo.create('u1', baseDto);
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.fee).toBeUndefined();
    });

    it('omits checklistItems from Prisma data', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      await repo.create('u1', baseDto);
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.checklistItems).toBeUndefined();
    });

    it('includes fee when provided', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      await repo.create('u1', { ...baseDto, fee: 1500 });
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.fee).toBe(1500);
    });

    it('does not create a musicFormConfig when enableMusicForm is false', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      await repo.create('u1', baseDto, false);
      expect(prisma.musicFormConfig.create).not.toHaveBeenCalled();
    });

    it('creates an empty musicFormConfig when enableMusicForm is true (no packages to seed from)', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      prisma.musicFormConfig.create.mockResolvedValue({ id: 'mfc1' });
      prisma.booking.findFirstOrThrow.mockResolvedValue({ id: 'b1' });
      await repo.create('u1', baseDto, true);
      expect(prisma.musicFormConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bookingId: 'b1', keyMoments: [], enabledGenres: [] }),
        }),
      );
    });
  });

  describe('findPackageTemplates', () => {
    it('queries by userId and ids', async () => {
      prisma.packageTemplate.findMany.mockResolvedValue([]);
      await repo.findPackageTemplates('u1', ['f1', 'f2']);
      expect(prisma.packageTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['f1', 'f2'] }, userId: 'u1' } }),
      );
    });
  });

  describe('createWithPackageTemplates', () => {
    const baseDto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] };

    function primeCreateChain() {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      prisma.package.create.mockResolvedValue({ id: 'pkg1' });
      prisma.performanceSet.create.mockResolvedValue({ id: 's1' });
      prisma.musicFormConfig.create.mockResolvedValue({ id: 'mfc1' });
      prisma.booking.findFirstOrThrow.mockResolvedValue({ id: 'b1' });
    }

    it('creates a booking-owned package snapshotting the template label/icon', async () => {
      primeCreateChain();
      const tmpl = {
        id: 'f1',
        defaultLineupTemplate: null,
        label: 'Ceremony',
        icon: 'heart',
        keyMoments: [],
        defaultGenreSelection: ['CONTEMPORARY'],
        slots: [{ label: 'Ceremony', duration: 30, order: 1 }],
      };
      await repo.createWithPackageTemplates('u1', baseDto, [tmpl], false);
      expect(prisma.package.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u1', bookingId: 'b1', order: 1, label: 'Ceremony', icon: 'heart' }),
        }),
      );
    });

    it('creates sets referencing the booking-owned package id (not the template id)', async () => {
      primeCreateChain();
      const tmpl = {
        id: 'f1',
        defaultLineupTemplate: null,
        label: 'Ceremony',
        icon: 'heart',
        keyMoments: [],
        defaultGenreSelection: ['CONTEMPORARY'],
        slots: [{ label: 'Ceremony', duration: 30, order: 1 }],
      };
      await repo.createWithPackageTemplates('u1', baseDto, [tmpl], false);
      expect(prisma.performanceSet.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ duration: 30, packageId: 'pkg1' }) }),
      );
    });

    it('creates musicFormConfig with keyMoments from templates when enableMusicForm', async () => {
      primeCreateChain();
      const tmpl = {
        id: 'f1',
        defaultLineupTemplate: null,
        label: 'Wedding Ceremony',
        icon: 'heart',
        keyMoments: ['Processional'],
        defaultGenreSelection: ['CLASSICAL'],
        slots: [],
      };
      await repo.createWithPackageTemplates('u1', baseDto, [tmpl], true);
      expect(prisma.musicFormConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            keyMoments: [{ label: 'Processional', section: 'Wedding Ceremony' }],
          }),
        }),
      );
    });

    it('creates musicFormConfig with empty keyMoments when templates have none but enableMusicForm', async () => {
      primeCreateChain();
      const tmpl = { id: 'f1', label: 'Background', icon: 'music', keyMoments: [], defaultGenreSelection: ['CONTEMPORARY'], slots: [], defaultLineupTemplate: null };
      await repo.createWithPackageTemplates('u1', baseDto, [tmpl], true);
      expect(prisma.musicFormConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ keyMoments: [] }) }),
      );
    });

    it('omits musicFormConfig when enableMusicForm is false', async () => {
      primeCreateChain();
      const tmpl = { id: 'f1', label: 'Background', icon: 'music', keyMoments: [], defaultGenreSelection: [], slots: [], defaultLineupTemplate: null };
      await repo.createWithPackageTemplates('u1', baseDto, [tmpl], false);
      expect(prisma.musicFormConfig.create).not.toHaveBeenCalled();
    });
  });

  describe('findOneForClone', () => {
    // The query shape itself: `cloneBookingCore`'s "soft-removed members are not copied" AC
    // (#889) rests entirely on this `where`, not on any code cloneBandRoster runs — a list that
    // arrives already filtered can't exercise that guarantee. Assert the query, not the result.
    it('filters bandMembers to removedAt: null and includes bandChairs unfiltered', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await repo.findOneForClone('u1', 'b1');
      const call = prisma.booking.findFirst.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'b1', userId: 'u1' });
      expect(call.include.bandMembers.where).toEqual({ removedAt: null });
      expect(call.include.bandChairs).toBeDefined();
      expect(call.include.bandChairs.where).toBeUndefined();
      expect(call.include.lineups.include.packages).toBe(true);
    });
  });

  describe('cloneBookingCore (Copy Event)', () => {
    // A fully-populated source: two packages, a packaged set + an ungrouped set, a music
    // form config, and lifecycle state (status/portalToken/deposit) that must NOT carry.
    function sourceBooking(overrides: Record<string, unknown> = {}) {
      return {
        id: 'src',
        userId: 'u1',
        status: 'COMPLETE', // a later lifecycle state — proves the copy forces a status, not carries it
        eventType: 'WEDDING',
        date: new Date('2026-01-01'),
        title: 'Smith Wedding',
        fee: '2500',
        notes: 'Arrive early',
        portalToken: 'old-token',
        depositReceivedAt: new Date('2025-12-01'),
        travelMode: 'DRIVE',
        logistics: { loadIn: '17:00' },
        customerId: 'cust1',
        venueId: 'venue1',
        bookingAgentId: 'agent1',
        seriesId: 'series1',
        packages: [
          { id: 'p1', label: 'Ceremony', icon: 'heart', order: 1 },
          { id: 'p2', label: 'Reception', icon: 'music', order: 2 },
        ],
        sets: [
          { id: 's1', order: 1, duration: 30, startTime: '14:00', label: 'Vows', packageId: 'p1' },
          { id: 's2', order: 2, duration: 45, startTime: null, label: null, packageId: null },
        ],
        // No band on the default fixture — see #889's own describe block below for a
        // fully-populated roster.
        lineups: [],
        bandChairs: [],
        bandMembers: [],
        musicFormConfig: { id: 'mfc', enabledGenres: ['JAZZ'], keyMoments: [{ label: 'First Dance', section: 'Reception' }] },
        checklistItems: [],
        ...overrides,
      } as unknown as Parameters<typeof repo.cloneBookingCore>[1];
    }

    function primeCloneChain() {
      prisma.booking.create.mockResolvedValue({ id: 'new1' });
      prisma.package.create
        .mockResolvedValueOnce({ id: 'newP1' })
        .mockResolvedValueOnce({ id: 'newP2' });
      prisma.performanceSet.create.mockResolvedValue({ id: 'newS' });
      prisma.bookingBandMember.create.mockImplementation(() => Promise.resolve({ id: `newM${prisma.bookingBandMember.create.mock.calls.length}` }));
      prisma.bookingBandChair.createMany.mockResolvedValue({ count: 0 });
      prisma.musicFormConfig.create.mockResolvedValue({ id: 'newMfc' });
      prisma.booking.findFirstOrThrow.mockResolvedValue({ id: 'new1' });
    }

    it('sets status to CONFIRMED and the new date, carrying the gig content fields', async () => {
      primeCloneChain();
      await repo.cloneBookingCore('u1', sourceBooking(), new Date('2026-09-15'));
      expect(prisma.booking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          status: 'CONFIRMED',
          date: new Date('2026-09-15'),
          eventType: 'WEDDING',
          title: 'Smith Wedding',
          fee: '2500',
          notes: 'Arrive early',
          travelMode: 'DRIVE',
          logistics: { loadIn: '17:00' },
          customerId: 'cust1',
          venueId: 'venue1',
          bookingAgentId: 'agent1',
          seriesId: 'series1',
        }),
      });
    });

    it('does NOT copy lifecycle state — no portalToken or depositReceivedAt in the create data', async () => {
      primeCloneChain();
      await repo.cloneBookingCore('u1', sourceBooking(), new Date('2026-09-15'));
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('portalToken'); // fresh @default(uuid()) fires
      expect(data).not.toHaveProperty('depositReceivedAt'); // stays null
      // Status is forced to CONFIRMED, not carried from the source's COMPLETE.
      expect(data.status).toBe('CONFIRMED');
    });

    it('clones each package and re-points cloned sets at the new package ids', async () => {
      primeCloneChain();
      await repo.cloneBookingCore('u1', sourceBooking(), new Date('2026-09-15'));
      expect(prisma.package.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bookingId: 'new1', label: 'Ceremony', icon: 'heart', order: 1 }),
        }),
      );
      expect(prisma.package.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ label: 'Reception' }) }),
      );
      // The packaged set must reference the CLONED package id, not the source 'p1'.
      expect(prisma.performanceSet.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ duration: 30, startTime: '14:00', label: 'Vows', packageId: 'newP1' }) }),
      );
    });

    it('clones ungrouped sets with packageId null', async () => {
      primeCloneChain();
      await repo.cloneBookingCore('u1', sourceBooking(), new Date('2026-09-15'));
      expect(prisma.performanceSet.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ duration: 45, packageId: null }) }),
      );
    });

    it('clones the music form config (genres + key moments) when present', async () => {
      primeCloneChain();
      await repo.cloneBookingCore('u1', sourceBooking(), new Date('2026-09-15'));
      expect(prisma.musicFormConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: 'new1',
            enabledGenres: ['JAZZ'],
            keyMoments: [{ label: 'First Dance', section: 'Reception' }],
          }),
        }),
      );
    });

    it('does not create a music form config when the source has none', async () => {
      primeCloneChain();
      await repo.cloneBookingCore('u1', sourceBooking({ musicFormConfig: null }), new Date('2026-09-15'));
      expect(prisma.musicFormConfig.create).not.toHaveBeenCalled();
    });

    // Band members v1 (#879), fourth slice: the roster copies (#889, ADR-0072; Lineups per
    // ADR-0081). A bandless source (the default fixture above) creates no band rows at all —
    // proven by the assertions in the tests above never touching bookingBandChair/bandMember/Lineup.
    describe('with a band roster', () => {
      function sourceWithBand(overrides: Record<string, unknown> = {}) {
        return sourceBooking({
          lineups: [
            { id: 'lu1', label: 'Trio', bookingId: 'src', packages: [{ packageId: 'p1' }] },
            { id: 'lu2', label: null, bookingId: 'src', packages: [] },
          ],
          bandMembers: [
            { id: 'm1', contactId: 'contact-filled', status: 'CONFIRMED', isSelf: false, sessionFee: '150.00', invitedAt: new Date('2026-01-02'), respondedAt: new Date('2026-01-03'), removedAt: null },
            { id: 'm2', contactId: 'contact-self', status: 'ADDED', isSelf: true, sessionFee: null, invitedAt: null, respondedAt: null, removedAt: null },
          ],
          bandChairs: [
            { id: 'ch1', role: 'Vocals', order: 1, lineupId: 'lu1', memberId: 'm1' },
            { id: 'ch2', role: 'Drums', order: 2, lineupId: 'lu1', memberId: null },
            { id: 'ch3', role: 'Bass', order: 3, lineupId: 'lu2', memberId: 'removed-member' },
          ],
          ...overrides,
        });
      }

      function primeCloneChainWithLineups() {
        primeCloneChain();
        prisma.lineup.create
          .mockResolvedValueOnce({ id: 'newLu1' })
          .mockResolvedValueOnce({ id: 'newLu2' });
      }

      it('clones each non-removed member with status reset to ADDED and no invite/response/removal timestamps', async () => {
        primeCloneChainWithLineups();
        await repo.cloneBookingCore('u1', sourceWithBand(), new Date('2026-09-15'));
        expect(prisma.bookingBandMember.create).toHaveBeenCalledWith({
          data: { userId: 'u1', bookingId: 'new1', contactId: 'contact-filled', status: 'ADDED', isSelf: false, sessionFee: '150.00' },
        });
        const [call] = prisma.bookingBandMember.create.mock.calls;
        expect(call[0].data).not.toHaveProperty('bandPortalToken'); // fresh @default(uuid()) fires
        expect(call[0].data).not.toHaveProperty('invitedAt');
        expect(call[0].data).not.toHaveProperty('respondedAt');
        expect(call[0].data).not.toHaveProperty('removedAt');
      });

      it('carries isSelf and omits sessionFee when the source has none', async () => {
        primeCloneChainWithLineups();
        await repo.cloneBookingCore('u1', sourceWithBand(), new Date('2026-09-15'));
        expect(prisma.bookingBandMember.create).toHaveBeenCalledWith({
          data: { userId: 'u1', bookingId: 'new1', contactId: 'contact-self', status: 'ADDED', isSelf: true },
        });
      });

      it('clones each Lineup with its label and re-points its segment links at cloned package ids', async () => {
        primeCloneChainWithLineups();
        await repo.cloneBookingCore('u1', sourceWithBand(), new Date('2026-09-15'));
        expect(prisma.lineup.create).toHaveBeenCalledWith({ data: { userId: 'u1', bookingId: 'new1', label: 'Trio' } });
        expect(prisma.lineup.create).toHaveBeenCalledWith({ data: { userId: 'u1', bookingId: 'new1', label: null } });
        expect(prisma.lineupPackage.create).toHaveBeenCalledWith({
          data: { userId: 'u1', lineupId: 'newLu1', packageId: 'newP1' },
        });
        // The package-less Lineup gets no link.
        expect(prisma.lineupPackage.create).toHaveBeenCalledTimes(1);
      });

      it('clones chairs with role, order and Lineup association intact, re-pointed at cloned ids', async () => {
        primeCloneChainWithLineups();
        await repo.cloneBookingCore('u1', sourceWithBand(), new Date('2026-09-15'));
        const data = prisma.bookingBandChair.createMany.mock.calls[0][0].data;
        expect(data).toContainEqual({ userId: 'u1', bookingId: 'new1', role: 'Vocals', order: 1, lineupId: 'newLu1', memberId: 'newM1' });
        expect(data).toContainEqual({ userId: 'u1', bookingId: 'new1', role: 'Drums', order: 2, lineupId: 'newLu1', memberId: null });
      });

      it('does not create a member row for a soft-removed member; the chair they held comes across as a vacancy', async () => {
        primeCloneChainWithLineups();
        await repo.cloneBookingCore('u1', sourceWithBand(), new Date('2026-09-15'));
        // Only the two non-removed source members are cloned — 'removed-member' was never in
        // source.bandMembers (findOneForClone already filters removedAt: null at the query).
        expect(prisma.bookingBandMember.create).toHaveBeenCalledTimes(2);
        // The chair that pointed at the (excluded) removed member comes back as a vacancy.
        const data = prisma.bookingBandChair.createMany.mock.calls[0][0].data;
        expect(data).toContainEqual({ userId: 'u1', bookingId: 'new1', role: 'Bass', order: 3, lineupId: 'newLu2', memberId: null });
      });

      it('creates no band rows when the source has no roster', async () => {
        primeCloneChain();
        await repo.cloneBookingCore('u1', sourceBooking(), new Date('2026-09-15'));
        expect(prisma.bookingBandMember.create).not.toHaveBeenCalled();
        expect(prisma.lineup.create).not.toHaveBeenCalled();
        expect(prisma.bookingBandChair.createMany).not.toHaveBeenCalled();
      });
    });
  });

  describe('applyPackageTemplate', () => {
    const tmpl = {
      id: 'f1',
      label: 'Ceremony',
      icon: 'heart',
      keyMoments: ['Processional'],
      defaultGenreSelection: ['CLASSICAL'],
      slots: [{ label: 'Processional', duration: 30, order: 1 }],
      defaultLineupTemplate: null,
    };

    const tmplWithLineup = {
      ...tmpl,
      defaultLineupTemplate: {
        id: 'lt1',
        label: 'My five-piece',
        slots: [{ role: 'Sax', order: 1 }, { role: 'Drums', order: 2 }],
      },
    };

    function primeApplyChain() {
      prisma.package.findMany.mockResolvedValue([]);
      prisma.performanceSet.findMany.mockResolvedValue([]);
      prisma.package.create.mockResolvedValue({ id: 'pkg1' });
      prisma.performanceSet.create.mockResolvedValue({ id: 's1' });
      prisma.lineup.create.mockResolvedValue({ id: 'lu1' });
      prisma.lineupPackage.create.mockResolvedValue({ id: 'lp1' });
      prisma.bookingBandChair.createMany.mockResolvedValue({ count: 0 });
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1' });
    }

    it('creates the booking-owned package + sets from the template', async () => {
      primeApplyChain();
      await repo.applyPackageTemplate('u1', 'b1', tmpl);
      expect(prisma.package.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bookingId: 'b1', label: 'Ceremony', icon: 'heart' }),
        }),
      );
      expect(prisma.performanceSet.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ packageId: 'pkg1', duration: 30 }) }),
      );
    });

    it('never writes the music form config — apply suggests, it does not force (ADR-0046 / #502)', async () => {
      primeApplyChain();
      await repo.applyPackageTemplate('u1', 'b1', tmpl);
      expect(prisma.musicFormConfig.create).not.toHaveBeenCalled();
      expect(prisma.musicFormConfig.update).not.toHaveBeenCalled();
    });

    it('creates no chairs or Lineup when the template has no default lineup', async () => {
      primeApplyChain();
      await repo.applyPackageTemplate('u1', 'b1', tmpl);
      expect(prisma.lineup.create).not.toHaveBeenCalled();
      expect(prisma.bookingBandChair.createMany).not.toHaveBeenCalled();
    });

    // ADR-0072 §3 / #884, re-pointed by ADR-0081: applying a package whose template declares a
    // default lineup auto-applies it as a fresh Lineup linked to the new package/segment.
    it('auto-applies the default lineup as a fresh Lineup linked to the new package, order starting at 1', async () => {
      primeApplyChain();
      await repo.applyPackageTemplate('u1', 'b1', tmplWithLineup);
      expect(prisma.lineup.create).toHaveBeenCalledWith({
        data: { userId: 'u1', bookingId: 'b1', label: 'My five-piece' },
      });
      expect(prisma.lineupPackage.create).toHaveBeenCalledWith({
        data: { userId: 'u1', lineupId: 'lu1', packageId: 'pkg1' },
      });
      const data = prisma.bookingBandChair.createMany.mock.calls[0][0].data;
      expect(data).toContainEqual({ userId: 'u1', bookingId: 'b1', lineupId: 'lu1', order: 1, role: 'Sax' });
      expect(data).toContainEqual({ userId: 'u1', bookingId: 'b1', lineupId: 'lu1', order: 2, role: 'Drums' });
    });
  });

  describe('removePackage', () => {
    it('orphans the package sets to ungrouped and deletes the package', async () => {
      prisma.musicFormConfig.findUnique.mockResolvedValue(null);
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1' });
      await repo.removePackage('b1', 'pkg1', 'Ceremony');
      expect(prisma.performanceSet.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'b1', packageId: 'pkg1' },
        data: { packageId: null },
      });
      expect(prisma.package.delete).toHaveBeenCalledWith({ where: { id: 'pkg1' } });
    });

    it('moves the package key moments to "Other" instead of deleting them (#502)', async () => {
      prisma.musicFormConfig.findUnique.mockResolvedValue({
        keyMoments: [
          { label: 'Processional', section: 'Ceremony' },
          { label: 'First dance', section: 'Reception' },
        ],
      });
      prisma.musicFormConfig.update.mockResolvedValue({ id: 'mfc1' });
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1' });

      await repo.removePackage('b1', 'pkg1', 'Ceremony');

      expect(prisma.musicFormConfig.update).toHaveBeenCalledWith({
        where: { bookingId: 'b1' },
        data: {
          keyMoments: [
            { label: 'Processional', section: 'Other' },
            { label: 'First dance', section: 'Reception' },
          ],
        },
      });
    });

    it('leaves the config untouched when no moments belong to the removed package', async () => {
      prisma.musicFormConfig.findUnique.mockResolvedValue({
        keyMoments: [{ label: 'First dance', section: 'Reception' }],
      });
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1' });

      await repo.removePackage('b1', 'pkg1', 'Ceremony');

      expect(prisma.musicFormConfig.update).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates by id and returns the result', async () => {
      const updated = { id: 'b1', status: 'CONFIRMED' };
      prisma.booking.update.mockResolvedValue(updated);
      const result = await repo.update('b1', { status: 'CONFIRMED' as BookingStatus });
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b1' }, data: { status: 'CONFIRMED' } }),
      );
      expect(result).toBe(updated);
    });
  });

  describe('cancel', () => {
    it('sets status to CANCELLED', async () => {
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' });
      await repo.cancel('b1');
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { status: BookingStatus.CANCELLED },
      });
    });
  });

  describe('findSet', () => {
    it('queries by setId, bookingId, and userId', async () => {
      prisma.performanceSet.findFirst.mockResolvedValue(null);
      await repo.findSet('u1', 'b1', 's1');
      expect(prisma.performanceSet.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', bookingId: 'b1', userId: 'u1' },
      });
    });
  });

  describe('addSet', () => {
    it('creates set with userId and bookingId', async () => {
      const set = { id: 's1' };
      prisma.performanceSet.create.mockResolvedValue(set);
      const result = await repo.addSet('u1', 'b1', { order: 1, duration: 45 });
      expect(prisma.performanceSet.create).toHaveBeenCalledWith({
        data: { userId: 'u1', bookingId: 'b1', order: 1, duration: 45 },
      });
      expect(result).toBe(set);
    });
  });

  describe('updateSet', () => {
    it('updates set by id', async () => {
      const updated = { id: 's1', duration: 60 };
      prisma.performanceSet.update.mockResolvedValue(updated);
      const result = await repo.updateSet('s1', { duration: 60 });
      expect(prisma.performanceSet.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { duration: 60 },
      });
      expect(result).toBe(updated);
    });
  });

  describe('deleteSet', () => {
    it('deletes set by id', async () => {
      const deleted = { id: 's1' };
      prisma.performanceSet.delete.mockResolvedValue(deleted);
      const result = await repo.deleteSet('s1');
      expect(prisma.performanceSet.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
      expect(result).toBe(deleted);
    });
  });

  describe('findChair', () => {
    it('queries by chairId, bookingId, and userId', async () => {
      prisma.bookingBandChair.findFirst.mockResolvedValue(null);
      await repo.findChair('u1', 'b1', 'ch1');
      expect(prisma.bookingBandChair.findFirst).toHaveBeenCalledWith({
        where: { id: 'ch1', bookingId: 'b1', userId: 'u1' },
      });
    });
  });

  describe('addChair', () => {
    it('joins the Lineup already playing the given segment, appending at the end', async () => {
      const chair = { id: 'ch1' };
      prisma.lineup.findFirst.mockResolvedValue({ id: 'lu1' });
      prisma.bookingBandChair.count.mockResolvedValue(2);
      prisma.bookingBandChair.create.mockResolvedValue(chair);
      const result = await repo.addChair('u1', 'b1', { role: 'Sax', packageId: 'pkg1' });
      expect(prisma.lineup.findFirst).toHaveBeenCalledWith({
        where: { bookingId: 'b1', packages: { some: { packageId: 'pkg1' } } },
        select: { id: true },
      });
      expect(prisma.bookingBandChair.create).toHaveBeenCalledWith({
        data: { userId: 'u1', bookingId: 'b1', lineupId: 'lu1', role: 'Sax', order: 3 },
      });
      expect(result).toBe(chair);
    });

    it('starts a new Lineup when none plays the given segment yet', async () => {
      prisma.lineup.findFirst.mockResolvedValue(null);
      prisma.lineup.create.mockResolvedValue({ id: 'lu2' });
      prisma.bookingBandChair.count.mockResolvedValue(0);
      prisma.bookingBandChair.create.mockResolvedValue({ id: 'ch1' });
      await repo.addChair('u1', 'b1', { role: 'Sax', packageId: 'pkg1' });
      expect(prisma.lineup.create).toHaveBeenCalledWith({ data: { userId: 'u1', bookingId: 'b1' } });
      expect(prisma.lineupPackage.create).toHaveBeenCalledWith({
        data: { userId: 'u1', lineupId: 'lu2', packageId: 'pkg1' },
      });
      expect(prisma.bookingBandChair.create).toHaveBeenCalledWith({
        data: { userId: 'u1', bookingId: 'b1', lineupId: 'lu2', role: 'Sax', order: 1 },
      });
    });

    it('resolves the package-less/whole-day Lineup (no segment links) when packageId is omitted', async () => {
      prisma.lineup.findFirst.mockResolvedValue({ id: 'lu3' });
      prisma.bookingBandChair.count.mockResolvedValue(0);
      prisma.bookingBandChair.create.mockResolvedValue({ id: 'ch1' });
      await repo.addChair('u1', 'b1', { role: 'Sax' });
      expect(prisma.lineup.findFirst).toHaveBeenCalledWith({
        where: { bookingId: 'b1', packages: { none: {} } },
        select: { id: true },
      });
      expect(prisma.lineupPackage.create).not.toHaveBeenCalled();
    });
  });

  describe('updateChair', () => {
    it('updates chair by id', async () => {
      const updated = { id: 'ch1', role: 'Drums' };
      prisma.bookingBandChair.update.mockResolvedValue(updated);
      const result = await repo.updateChair('ch1', { role: 'Drums' }, 'lu1');
      expect(prisma.bookingBandChair.update).toHaveBeenCalledWith({
        where: { id: 'ch1' },
        data: { role: 'Drums' },
      });
      expect(result).toBe(updated);
    });

    it('does not garbage-collect anything when the chair is not re-parented', async () => {
      prisma.bookingBandChair.update.mockResolvedValue({ id: 'ch1' });
      await repo.updateChair('ch1', { role: 'Drums' }, 'lu1');
      expect(prisma.bookingBandChair.count).not.toHaveBeenCalled();
      expect(prisma.lineup.deleteMany).not.toHaveBeenCalled();
    });

    // Symmetric with deleteChair: re-parenting a chair away from a Lineup can leave it empty too —
    // "an empty Lineup is clutter" (ADR-0081) must hold on every path that can vacate one.
    it('garbage-collects the source Lineup when re-parenting leaves it empty', async () => {
      prisma.bookingBandChair.update.mockResolvedValue({ id: 'ch1', lineupId: 'lu2' });
      prisma.bookingBandChair.count.mockResolvedValue(0);
      await repo.updateChair('ch1', { lineupId: 'lu2' }, 'lu1');
      expect(prisma.bookingBandChair.count).toHaveBeenCalledWith({ where: { lineupId: 'lu1' } });
      expect(prisma.lineup.deleteMany).toHaveBeenCalledWith({ where: { id: 'lu1' } });
    });

    it('does not garbage-collect the source Lineup when it still holds other chairs', async () => {
      prisma.bookingBandChair.update.mockResolvedValue({ id: 'ch1', lineupId: 'lu2' });
      prisma.bookingBandChair.count.mockResolvedValue(1);
      await repo.updateChair('ch1', { lineupId: 'lu2' }, 'lu1');
      expect(prisma.lineup.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteChair', () => {
    it('deletes the chair and leaves the Lineup alone when other chairs remain', async () => {
      const deleted = { id: 'ch1' };
      prisma.bookingBandChair.delete.mockResolvedValue(deleted);
      prisma.bookingBandChair.count.mockResolvedValue(1);
      const result = await repo.deleteChair('ch1', 'lu1');
      expect(prisma.bookingBandChair.delete).toHaveBeenCalledWith({ where: { id: 'ch1' } });
      expect(prisma.bookingBandChair.count).toHaveBeenCalledWith({ where: { lineupId: 'lu1' } });
      expect(prisma.lineup.deleteMany).not.toHaveBeenCalled();
      expect(result).toBe(deleted);
    });

    // deleteMany, not delete: two concurrent removals of a 2-chair Lineup can both see count() ===
    // 0 and race to GC it — deleteMany is idempotent where delete would throw P2025 on the loser.
    it('garbage-collects the Lineup when it held the last chair', async () => {
      prisma.bookingBandChair.delete.mockResolvedValue({ id: 'ch1' });
      prisma.bookingBandChair.count.mockResolvedValue(0);
      await repo.deleteChair('ch1', 'lu1');
      expect(prisma.lineup.deleteMany).toHaveBeenCalledWith({ where: { id: 'lu1' } });
    });
  });

  describe('findActiveMemberByContact', () => {
    it('queries by contactId, bookingId, userId, and excludes removed rows', async () => {
      prisma.bookingBandMember.findFirst.mockResolvedValue(null);
      await repo.findActiveMemberByContact('u1', 'b1', 'c1');
      expect(prisma.bookingBandMember.findFirst).toHaveBeenCalledWith({
        where: { userId: 'u1', bookingId: 'b1', contactId: 'c1', removedAt: null },
      });
    });
  });

  describe('createMember', () => {
    it('creates a member row with userId, bookingId, and contactId', async () => {
      const member = { id: 'm1' };
      prisma.bookingBandMember.create.mockResolvedValue(member);
      const result = await repo.createMember('u1', 'b1', 'c1');
      expect(prisma.bookingBandMember.create).toHaveBeenCalledWith({
        data: { userId: 'u1', bookingId: 'b1', contactId: 'c1' },
      });
      expect(result).toBe(member);
    });
  });

  describe('setChairMember', () => {
    it('sets memberId on the chair', async () => {
      const chair = { id: 'ch1', memberId: 'm1' };
      prisma.bookingBandChair.update.mockResolvedValue(chair);
      const result = await repo.setChairMember('ch1', 'm1');
      expect(prisma.bookingBandChair.update).toHaveBeenCalledWith({
        where: { id: 'ch1' },
        data: { memberId: 'm1' },
      });
      expect(result).toBe(chair);
    });

    it('nulls memberId to vacate', async () => {
      prisma.bookingBandChair.update.mockResolvedValue({ id: 'ch1', memberId: null });
      await repo.setChairMember('ch1', null);
      expect(prisma.bookingBandChair.update).toHaveBeenCalledWith({
        where: { id: 'ch1' },
        data: { memberId: null },
      });
    });
  });

  describe('findMember', () => {
    it('queries by memberId, bookingId, userId, and excludes removed rows', async () => {
      prisma.bookingBandMember.findFirst.mockResolvedValue(null);
      await repo.findMember('u1', 'b1', 'm1');
      expect(prisma.bookingBandMember.findFirst).toHaveBeenCalledWith({
        where: { id: 'm1', bookingId: 'b1', userId: 'u1', removedAt: null },
      });
    });
  });

  describe('updateMember', () => {
    it('updates the member row by id', async () => {
      const updated = { id: 'm1', status: 'CONFIRMED' };
      prisma.bookingBandMember.update.mockResolvedValue(updated);
      const result = await repo.updateMember('m1', { status: 'CONFIRMED' });
      expect(prisma.bookingBandMember.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'CONFIRMED' },
      });
      expect(result).toBe(updated);
    });
  });

  describe('removeMember', () => {
    it('vacates every chair held by the member, then stamps removedAt', async () => {
      const order: string[] = [];
      prisma.bookingBandChair.updateMany.mockImplementation(() => {
        order.push('vacate');
        return Promise.resolve({ count: 2 });
      });
      prisma.bookingBandMember.update.mockImplementation(() => {
        order.push('remove');
        return Promise.resolve({ id: 'm1' });
      });

      await repo.removeMember('m1');

      expect(prisma.bookingBandChair.updateMany).toHaveBeenCalledWith({
        where: { memberId: 'm1' },
        data: { memberId: null },
      });
      expect(prisma.bookingBandMember.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { removedAt: expect.any(Date) },
      });
      expect(order).toEqual(['vacate', 'remove']);
    });
  });

  describe('applyLineupTemplate', () => {
    const lineup = { label: 'My five-piece', slots: [{ role: 'Sax', order: 1 }, { role: 'Drums', order: 2 }] };

    function primeChain() {
      prisma.lineup.findMany.mockResolvedValue([]);
      prisma.lineup.deleteMany.mockResolvedValue({ count: 0 });
      prisma.lineup.create.mockResolvedValue({ id: 'newLu' });
      prisma.lineupPackage.create.mockResolvedValue({ id: 'lp1' });
      prisma.bookingBandChair.createMany.mockResolvedValue({ count: 2 });
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1' });
    }

    it('creates a fresh Lineup with the template label', async () => {
      primeChain();
      await repo.applyLineupTemplate('u1', 'b1', lineup, null);
      expect(prisma.lineup.create).toHaveBeenCalledWith({ data: { userId: 'u1', bookingId: 'b1', label: 'My five-piece' } });
    });

    it('creates one chair per lineup slot, order starting at 1, preserving role', async () => {
      primeChain();
      await repo.applyLineupTemplate('u1', 'b1', lineup, null);
      const data = prisma.bookingBandChair.createMany.mock.calls[0][0].data;
      expect(data).toContainEqual({ userId: 'u1', bookingId: 'b1', lineupId: 'newLu', order: 1, role: 'Sax' });
      expect(data).toContainEqual({ userId: 'u1', bookingId: 'b1', lineupId: 'newLu', order: 2, role: 'Drums' });
    });

    it('links the new Lineup to the given package', async () => {
      primeChain();
      await repo.applyLineupTemplate('u1', 'b1', lineup, 'pkg1');
      expect(prisma.lineupPackage.create).toHaveBeenCalledWith({ data: { userId: 'u1', lineupId: 'newLu', packageId: 'pkg1' } });
    });

    it('creates no segment link when applied package-less', async () => {
      primeChain();
      await repo.applyLineupTemplate('u1', 'b1', lineup, null);
      expect(prisma.lineupPackage.create).not.toHaveBeenCalled();
    });

    // #884, per advisor review: re-applying a different lineup to the same segment must not stack
    // on top of the first apply — "the musician can pick a different one" means the pick REPLACES
    // the whole band playing that segment, not append to it (ADR-0081 §4).
    it('replaces the Lineup already playing the targeted segment rather than appending', async () => {
      prisma.lineup.findMany.mockResolvedValue([{ id: 'oldLu' }]);
      primeChain();
      prisma.lineup.findMany.mockResolvedValue([{ id: 'oldLu' }]);
      await repo.applyLineupTemplate('u1', 'b1', lineup, 'pkg1');
      expect(prisma.lineup.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'b1', packages: { some: { packageId: 'pkg1' } } },
        select: { id: true },
      });
      expect(prisma.lineup.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['oldLu'] } } });
    });

    it('replaces the Lineup already playing the package-less segment rather than appending', async () => {
      primeChain();
      prisma.lineup.findMany.mockResolvedValue([{ id: 'oldLu' }]);
      await repo.applyLineupTemplate('u1', 'b1', lineup, null);
      expect(prisma.lineup.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'b1', packages: { none: {} } },
        select: { id: true },
      });
      expect(prisma.lineup.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['oldLu'] } } });
    });

    it('does not delete anything when no Lineup already plays the targeted segment', async () => {
      primeChain();
      await repo.applyLineupTemplate('u1', 'b1', lineup, 'pkg1');
      expect(prisma.lineup.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes the old Lineup before creating the new one', async () => {
      const order: string[] = [];
      prisma.lineup.findMany.mockResolvedValue([{ id: 'oldLu' }]);
      prisma.lineup.deleteMany.mockImplementation(() => {
        order.push('delete');
        return Promise.resolve({ count: 1 });
      });
      prisma.lineup.create.mockImplementation(() => {
        order.push('create');
        return Promise.resolve({ id: 'newLu' });
      });
      prisma.lineupPackage.create.mockResolvedValue({ id: 'lp1' });
      prisma.bookingBandChair.createMany.mockResolvedValue({ count: 2 });
      prisma.booking.findFirst.mockResolvedValue({ id: 'b1' });

      await repo.applyLineupTemplate('u1', 'b1', lineup, 'pkg1');
      expect(order).toEqual(['delete', 'create']);
    });
  });
});
