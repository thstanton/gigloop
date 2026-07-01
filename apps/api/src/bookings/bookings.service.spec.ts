import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { ContractRepository } from './contract.repository';
import { MusicFormConfigRepository } from './music-form-config.repository';
import { ChecklistRepository } from '../checklist/checklist.repository';
import { SeriesRepository } from '../series/series.repository';
import { SeriesService } from '../series/series.service';
import { MailService } from '../mail/mail.service';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { PrismaService } from '../prisma/prisma.service';
import type { EmailContext } from '../mail/mail.service';

// Tagged sentinel handed to the $transaction callback as `tx`. Asserting each write
// received THIS object proves all writes are enrolled in the one transaction (ADR-0047).
const TX = { __tx: true } as const;

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  findForOwnership: jest.Mock;
  findOneForClone: jest.Mock;
  cloneBookingCore: jest.Mock;
  create: jest.Mock;
  findPackageTemplates: jest.Mock;
  createWithPackageTemplates: jest.Mock;
  findBookingPackage: jest.Mock;
  applyPackageTemplate: jest.Mock;
  updatePackage: jest.Mock;
  removePackage: jest.Mock;
  update: jest.Mock;
  cancel: jest.Mock;
  findSet: jest.Mock;
  addSet: jest.Mock;
  updateSet: jest.Mock;
  deleteSet: jest.Mock;
  findUserProfile: jest.Mock;
  findChecklistItems: jest.Mock;
  countNonVoidInvoices: jest.Mock;
  updateSeries: jest.Mock;
  findChecklistItemById: jest.Mock;
  findChecklistItemsForReminders: jest.Mock;
  setDepositReceivedAt: jest.Mock;
  clearDepositReceivedAt: jest.Mock;
};

type MockContractRepo = {
  findContractTemplate: jest.Mock;
  findActiveContract: jest.Mock;
  createContractRecord: jest.Mock;
  markContractSent: jest.Mock;
  voidContract: jest.Mock;
  updateContract: jest.Mock;
  findContractById: jest.Mock;
  deleteContract: jest.Mock;
};

type MockMusicFormRepo = {
  findMusicFormConfig: jest.Mock;
  upsertMusicFormConfig: jest.Mock;
  deleteMusicFormConfig: jest.Mock;
  findMusicFormResponse: jest.Mock;
  findSongsByIds: jest.Mock;
};

type MockSeriesRepo = { findOne: jest.Mock; findOneLight: jest.Mock; findExists: jest.Mock; create: jest.Mock };
type MockMail = { buildContext: jest.Mock };
type MockEvaluator = { evaluate: jest.Mock };
type MockChecklistRepo = {
  findActionItems: jest.Mock;
  seedChecklistItems: jest.Mock;
  recomputeChecklistDueDates: jest.Mock;
  updateChecklistItemState: jest.Mock;
  findItemByKey: jest.Mock;
  seedReminderItem: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findForOwnership: jest.fn().mockResolvedValue({ id: 'b1', userId: 'u1' }),
    findOneForClone: jest.fn(),
    cloneBookingCore: jest.fn(),
    create: jest.fn(),
    findPackageTemplates: jest.fn(),
    createWithPackageTemplates: jest.fn(),
    findBookingPackage: jest.fn(),
    applyPackageTemplate: jest.fn(),
    updatePackage: jest.fn(),
    removePackage: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    findSet: jest.fn(),
    addSet: jest.fn(),
    updateSet: jest.fn(),
    deleteSet: jest.fn(),
    findUserProfile: jest.fn(),
    findChecklistItems: jest.fn(),
    countNonVoidInvoices: jest.fn(),
    updateSeries: jest.fn(),
    findChecklistItemById: jest.fn(),
    findChecklistItemsForReminders: jest.fn().mockResolvedValue([]),
    setDepositReceivedAt: jest.fn().mockResolvedValue(undefined),
    clearDepositReceivedAt: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMail(): MockMail {
  return { buildContext: jest.fn() };
}

function makeEvaluator(): MockEvaluator {
  return { evaluate: jest.fn().mockResolvedValue(undefined) };
}

function makeSeriesRepo(): MockSeriesRepo {
  return { findOne: jest.fn(), findOneLight: jest.fn(), findExists: jest.fn(), create: jest.fn() };
}

function makeSeriesService() {
  return {
    assertMembershipMutable: jest.fn().mockResolvedValue(undefined),
    syncMemberJoin: jest.fn().mockResolvedValue(undefined),
    syncMemberLeave: jest.fn().mockResolvedValue(undefined),
  };
}

function makeChecklistRepo(): MockChecklistRepo {
  return {
    findActionItems: jest.fn().mockResolvedValue([]),
    seedChecklistItems: jest.fn().mockResolvedValue({ count: 10 }),
    recomputeChecklistDueDates: jest.fn().mockResolvedValue(undefined),
    updateChecklistItemState: jest.fn().mockResolvedValue({ count: 1 }),
    findItemByKey: jest.fn().mockResolvedValue(null),
    seedReminderItem: jest.fn().mockResolvedValue({ id: 'seeded' }),
  };
}

function makeContractRepo(): MockContractRepo {
  return {
    findContractTemplate: jest.fn(),
    findActiveContract: jest.fn(),
    createContractRecord: jest.fn(),
    markContractSent: jest.fn(),
    voidContract: jest.fn(),
    updateContract: jest.fn(),
    findContractById: jest.fn(),
    deleteContract: jest.fn(),
  };
}

function makeMusicFormRepo(): MockMusicFormRepo {
  return {
    findMusicFormConfig: jest.fn(),
    upsertMusicFormConfig: jest.fn(),
    deleteMusicFormConfig: jest.fn(),
    findMusicFormResponse: jest.fn(),
    findSongsByIds: jest.fn(),
  };
}

type MockPrisma = { $transaction: jest.Mock; $queryRaw: jest.Mock };

function makePrisma(): MockPrisma {
  return {
    // Run the interactive-transaction callback with the tagged sentinel as `tx`.
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(TX)),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };
}

const booking = { id: 'b1', userId: 'u1', status: BookingStatus.CONFIRMED };
const set = { id: 's1', bookingId: 'b1', userId: 'u1' };

const baseContext: EmailContext = {
  customerName: 'Jane Smith',
  greetingName: 'Jane',
  bookingDate: '2026-08-15',
  venueName: 'The Grand Hotel',
  bookingFee: '£1,500.00',
  setsSchedule: '',
  musicianName: 'Tim Stanton',
  musicianEmail: 'tim@example.com',
  portalLink: 'https://app.gigman.com/booking/abc123',
  issueDate: '',
  invoiceTotal: '',
  invoiceDueDate: '',
};

describe('BookingsService', () => {
  let service: BookingsService;
  let repo: MockRepo;
  let seriesRepo: MockSeriesRepo;
  let seriesService: ReturnType<typeof makeSeriesService>;
  let mail: MockMail;
  let evaluator: MockEvaluator;
  let checklistRepo: MockChecklistRepo;
  let contractRepo: MockContractRepo;
  let musicFormRepo: MockMusicFormRepo;
  let prisma: MockPrisma;

  beforeEach(() => {
    repo = makeRepo();
    seriesRepo = makeSeriesRepo();
    seriesService = makeSeriesService();
    mail = makeMail();
    evaluator = makeEvaluator();
    checklistRepo = makeChecklistRepo();
    contractRepo = makeContractRepo();
    musicFormRepo = makeMusicFormRepo();
    prisma = makePrisma();
    service = new BookingsService(
      repo as unknown as BookingsRepository,
      seriesRepo as unknown as SeriesRepository,
      seriesService as unknown as SeriesService,
      mail as unknown as MailService,
      evaluator as unknown as ChecklistEvaluatorService,
      checklistRepo as unknown as ChecklistRepository,
      contractRepo as unknown as ContractRepository,
      musicFormRepo as unknown as MusicFormConfigRepository,
      prisma as unknown as PrismaService,
    );
  });

  describe('findAll', () => {
    it('delegates with an empty array when no status is given', async () => {
      repo.findAll.mockResolvedValue([booking]);
      const result = await service.findAll('u1');
      expect(repo.findAll).toHaveBeenCalledWith('u1', [], undefined, undefined, undefined, undefined);
      expect(result).toEqual([booking]);
    });

    it('passes a single valid status as a one-element array', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', 'CONFIRMED');
      expect(repo.findAll).toHaveBeenCalledWith('u1', ['CONFIRMED'], undefined, undefined, undefined, undefined);
    });

    it('passes multiple valid statuses as an array', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', ['CONFIRMED', 'READY']);
      expect(repo.findAll).toHaveBeenCalledWith('u1', ['CONFIRMED', 'READY'], undefined, undefined, undefined, undefined);
    });

    it('passes the search query to the repository', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', undefined, 'smith');
      expect(repo.findAll).toHaveBeenCalledWith('u1', [], 'smith', undefined, undefined, undefined);
    });

    it('passes the event type to the repository', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', undefined, undefined, 'WEDDING');
      expect(repo.findAll).toHaveBeenCalledWith('u1', [], undefined, 'WEDDING', undefined, undefined);
    });

    it('passes event type alongside status and search query', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', 'CONFIRMED', 'smith', 'CORPORATE');
      expect(repo.findAll).toHaveBeenCalledWith('u1', ['CONFIRMED'], 'smith', 'CORPORATE', undefined, undefined);
    });

    it('passes from and to date bounds to the repository', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', undefined, undefined, undefined, '2026-04-06', '2027-04-05');
      expect(repo.findAll).toHaveBeenCalledWith('u1', [], undefined, undefined, '2026-04-06', '2027-04-05');
    });

    it('passes date bounds alongside status, search query, and event type', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', 'CONFIRMED', 'smith', 'WEDDING', '2026-04-06', '2027-04-05');
      expect(repo.findAll).toHaveBeenCalledWith('u1', ['CONFIRMED'], 'smith', 'WEDDING', '2026-04-06', '2027-04-05');
    });

    it('throws BadRequestException for an unrecognised status', () => {
      expect(() => service.findAll('u1', 'NONSENSE')).toThrow(BadRequestException);
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when any status in an array is invalid', () => {
      expect(() => service.findAll('u1', ['CONFIRMED', 'NONSENSE'])).toThrow(BadRequestException);
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('accepts CANCELLED as a valid status', async () => {
      repo.findAll.mockResolvedValue([]);
      await expect(service.findAll('u1', 'CANCELLED')).resolves.not.toThrow();
    });
  });

  describe('findOne', () => {
    it('returns the booking with hasMusicFormConfig and hasMusicFormResponse flags', async () => {
      repo.findOne.mockResolvedValue({ ...booking, musicFormConfig: null, musicFormResponse: null });
      const result = await service.findOne('u1', 'b1');
      expect(repo.findOne).toHaveBeenCalledWith('u1', 'b1');
      expect(result).toMatchObject({ id: 'b1', hasMusicFormConfig: false, hasMusicFormResponse: false });
    });

    it('sets hasMusicFormConfig true when config exists', async () => {
      repo.findOne.mockResolvedValue({ ...booking, musicFormConfig: { id: 'mfc1' }, musicFormResponse: null });
      const result = await service.findOne('u1', 'b1');
      expect(result.hasMusicFormConfig).toBe(true);
      expect(result.hasMusicFormResponse).toBe(false);
    });

    it('throws NotFoundException when repository returns null', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('returns cancelled bookings', async () => {
      const cancelled = { ...booking, status: BookingStatus.CANCELLED };
      repo.findOne.mockResolvedValue(cancelled);
      const result = await service.findOne('u1', 'b1');
      expect(result.status).toBe(BookingStatus.CANCELLED);
    });

    // ADR-0054 / #579: the admin indicator reads the same authority as the portal. A cancelled
    // booking hides the whole contract concern ("Not visible — cancelled") while the music-form
    // concern is unchanged by cancellation — proving buildPortalVisibility feeds booking.status
    // through, not just that the authority works in isolation.
    it('maps a cancelled booking to a cancelled contract verdict, music form unchanged', async () => {
      repo.findOne.mockResolvedValue({
        ...booking,
        status: BookingStatus.CANCELLED,
        contracts: [
          { id: 'c1', status: 'SENT', createdAt: new Date(), updatedAt: new Date(), content: null, signedAt: null },
        ],
        musicFormConfig: { id: 'mfc1' },
        musicFormResponse: null,
      });
      const result = await service.findOne('u1', 'b1');
      expect(result.portalVisibility.contract).toEqual({ visible: false, reason: 'cancelled' });
      expect(result.portalVisibility.musicForm).toEqual({ visible: true });
    });
  });

  describe('create', () => {
    const createdBooking = { ...booking, date: new Date('2026-06-01'), createdAt: new Date('2026-01-01') };

    it('delegates to repo.create when no packageTemplateIds provided', async () => {
      repo.create.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] };
      const result = await service.create('u1', dto);
      // enableMusicForm defaults to false when the dto omits it.
      expect(repo.create).toHaveBeenCalledWith('u1', dto, false, TX);
      expect(repo.findPackageTemplates).not.toHaveBeenCalled();
      expect(result).toBe(createdBooking);
    });

    it('evaluates auto-complete rules after commit so structural items reflect data set at creation (#511)', async () => {
      repo.create.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] };
      await service.create('u1', dto);
      expect(evaluator.evaluate).toHaveBeenCalledWith(createdBooking.id);
    });

    it('seeds checklist items from dto.checklistItems', async () => {
      repo.create.mockResolvedValue(createdBooking);
      const checklistItems = [{ label: 'Send quote', key: 'send_quote', completedBy: 'USER' as const, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'PROVISIONAL' as const, dueDateRule: null }];
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems };
      await service.create('u1', dto);
      expect(checklistRepo.seedChecklistItems).toHaveBeenCalledWith(
        'u1', createdBooking.id, checklistItems, createdBooking.date, createdBooking.createdAt, TX,
      );
    });

    it('skips seeding when checklistItems is empty', async () => {
      repo.create.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] };
      await service.create('u1', dto);
      expect(checklistRepo.seedChecklistItems).not.toHaveBeenCalled();
    });

    it('threads a concern-tagged custom item through to the seed (#560)', async () => {
      repo.create.mockResolvedValue(createdBooking);
      const checklistItems = [
        { label: 'Hire the marquee', completedBy: 'USER' as const, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'CONFIRMED' as const, dueDateRule: null, concern: 'venue' as const },
      ];
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems };
      await service.create('u1', dto);
      expect(checklistRepo.seedChecklistItems).toHaveBeenCalledWith(
        'u1', createdBooking.id, expect.arrayContaining([expect.objectContaining({ concern: 'venue' })]),
        createdBooking.date, createdBooking.createdAt, TX,
      );
    });

    it('fetches templates and calls createWithPackageTemplates when packageTemplateIds provided', async () => {
      const tmpl = { id: 'f1', label: 'Wedding Ceremony', icon: 'heart', keyMoments: ['Processional'], defaultGenreSelection: ['CONTEMPORARY'], slots: [] };
      repo.findPackageTemplates.mockResolvedValue([tmpl]);
      repo.createWithPackageTemplates.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', packageTemplateIds: ['f1'], checklistItems: [] };
      const result = await service.create('u1', dto);
      expect(repo.findPackageTemplates).toHaveBeenCalledWith('u1', ['f1']);
      // No enableMusicForm in the dto → music form off (config row not created).
      expect(repo.createWithPackageTemplates).toHaveBeenCalledWith('u1', dto, [tmpl], false, TX);
      expect(result).toBe(createdBooking);
    });

    it('passes enableMusicForm=true to createWithPackageTemplates when the dto opts in', async () => {
      const tmpl = { id: 'f1', label: 'Wedding Ceremony', icon: 'heart', keyMoments: [], defaultGenreSelection: [], slots: [] };
      repo.findPackageTemplates.mockResolvedValue([tmpl]);
      repo.createWithPackageTemplates.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', packageTemplateIds: ['f1'], enableMusicForm: true, checklistItems: [] };
      await service.create('u1', dto);
      expect(repo.createWithPackageTemplates).toHaveBeenCalledWith('u1', dto, [tmpl], true, TX);
    });

    it('passes enableMusicForm=true to repo.create when opting in with no packages', async () => {
      repo.create.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', enableMusicForm: true, checklistItems: [] };
      await service.create('u1', dto);
      expect(repo.create).toHaveBeenCalledWith('u1', expect.objectContaining({ enableMusicForm: true }), true, TX);
    });

    it('preserves order from packageTemplateIds when creating with templates', async () => {
      const tmpl1 = { id: 'f1', label: 'A', icon: 'music', keyMoments: [], defaultGenreSelection: [], slots: [] };
      const tmpl2 = { id: 'f2', label: 'B', icon: 'music', keyMoments: [], defaultGenreSelection: [], slots: [] };
      repo.findPackageTemplates.mockResolvedValue([tmpl2, tmpl1]); // reversed from DB
      repo.findUserProfile.mockResolvedValue(null);
      repo.createWithPackageTemplates.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', packageTemplateIds: ['f1', 'f2'], checklistItems: [] };
      await service.create('u1', dto);
      const orderedTemplates = repo.createWithPackageTemplates.mock.calls[0][2];
      expect(orderedTemplates[0].id).toBe('f1');
      expect(orderedTemplates[1].id).toBe('f2');
    });

    // ADR-0047 — atomic create (Path A regression guard). The unit-level proof is that
    // every write is enrolled in ONE $transaction (the literal "no booking row persists"
    // is Postgres's rollback, exercised at the integration tier, not by these mocks).
    describe('atomicity (ADR-0047 / Path A)', () => {
      const createdBooking = {
        ...booking,
        date: new Date('2026-06-01'),
        createdAt: new Date('2026-01-01'),
        fee: 100,
        sets: [],
      };
      const checklistItems = [
        { label: 'Send quote', key: 'send_quote', completedBy: 'USER' as const, dependsOn: [], autoCompleteRule: null, requiredForStatus: null, dueDateRule: null },
      ];

      it('opens a single transaction and enrols the booking + checklist + series writes in it', async () => {
        repo.create.mockResolvedValue(createdBooking);
        seriesRepo.findExists.mockResolvedValue(true);
        const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', seriesId: 's1', checklistItems };

        await service.create('u1', dto);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        // The same tx sentinel reaches each write — proof they share one atomic unit.
        expect(repo.create).toHaveBeenCalledWith('u1', expect.objectContaining({ seriesId: 's1' }), false, TX);
        expect(checklistRepo.seedChecklistItems).toHaveBeenCalledWith('u1', createdBooking.id, checklistItems, createdBooking.date, createdBooking.createdAt, TX);
        expect(seriesService.syncMemberJoin).toHaveBeenCalledWith('u1', 's1', expect.objectContaining({ id: createdBooking.id }), TX);
      });

      it('warms the connection before opening the transaction (cold-start handling)', async () => {
        repo.create.mockResolvedValue(createdBooking);
        const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] };

        await service.create('u1', dto);

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        // Warm-up ping runs before the transaction so a Neon cold-start is absorbed outside the tx timeout.
        expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
      });

      it('propagates a checklist-seed failure so the transaction rolls back (no orphan booking)', async () => {
        repo.create.mockResolvedValue(createdBooking);
        checklistRepo.seedChecklistItems.mockRejectedValue(new Error('seed failed'));
        const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems };

        await expect(service.create('u1', dto)).rejects.toThrow('seed failed');
        // The throw happens inside the $transaction callback, so Prisma rolls the booking back.
        expect(seriesService.syncMemberJoin).not.toHaveBeenCalled();
      });

      it('propagates a series-append failure from inside the transaction', async () => {
        repo.create.mockResolvedValue(createdBooking);
        seriesRepo.findExists.mockResolvedValue(true);
        seriesService.syncMemberJoin.mockRejectedValue(new Error('append failed'));
        const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', seriesId: 's1', checklistItems: [] };

        await expect(service.create('u1', dto)).rejects.toThrow('append failed');
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('copyBooking (Copy Event #507)', () => {
    const newBooking = {
      ...booking,
      id: 'copy1',
      status: BookingStatus.CONFIRMED,
      date: new Date('2026-09-15'),
      createdAt: new Date('2026-02-02'),
      fee: 100,
      sets: [{ label: 'Set 1', duration: 45 }],
      seriesId: 's1',
    };

    // A source loaded for cloning: a COMPLETE checklist item that must reset, plus a
    // seriesId so the membership guard + series sync run.
    function sourceForClone(overrides: Record<string, unknown> = {}) {
      return {
        id: 'src',
        userId: 'u1',
        seriesId: 's1',
        checklistItems: [
          {
            id: 'ci1',
            key: 'send_quote',
            label: 'Send quote',
            completedBy: 'USER',
            state: 'COMPLETE',
            completedAt: new Date('2026-01-10'),
            dependsOn: [],
            autoCompleteRule: null,
            requiredForStatus: 'PROVISIONAL',
            dueDate: new Date('2026-01-05'),
            dueDateRule: { basis: 'bookingDate', offsetDays: -30 },
          },
        ],
        ...overrides,
      };
    }

    it('throws NotFoundException and does not clone when the source booking is missing', async () => {
      repo.findOneForClone.mockResolvedValue(null);
      await expect(service.copyBooking('u1', 'missing', { date: '2026-09-15' })).rejects.toThrow(NotFoundException);
      expect(repo.cloneBookingCore).not.toHaveBeenCalled();
    });

    it('clones the source into the new date and returns the new booking', async () => {
      repo.findOneForClone.mockResolvedValue(sourceForClone({ seriesId: null }));
      repo.cloneBookingCore.mockResolvedValue({ ...newBooking, seriesId: null });
      const result = await service.copyBooking('u1', 'src', { date: '2026-09-15' });
      expect(repo.cloneBookingCore).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'src' }), new Date('2026-09-15'), TX);
      expect(result).toMatchObject({ id: 'copy1', status: BookingStatus.CONFIRMED });
    });

    it('reseeds the checklist with completion + due dates reset against the new booking', async () => {
      repo.findOneForClone.mockResolvedValue(sourceForClone({ seriesId: null }));
      repo.cloneBookingCore.mockResolvedValue({ ...newBooking, seriesId: null });
      await service.copyBooking('u1', 'src', { date: '2026-09-15' });

      const [uid, bookingId, seeds, date, createdAt, tx] = checklistRepo.seedChecklistItems.mock.calls[0];
      expect(uid).toBe('u1');
      expect(bookingId).toBe('copy1');
      // Recompute basis is the NEW booking's date/createdAt, not the source's.
      expect(date).toBe(newBooking.date);
      expect(createdAt).toBe(newBooking.createdAt);
      expect(tx).toBe(TX);
      // The seed carries the rule (so seedChecklistItems recomputes the due date) but drops
      // completion — no `state`, `completedAt`, or precomputed `dueDate` survive the copy.
      expect(seeds[0]).toEqual({
        key: 'send_quote',
        label: 'Send quote',
        completedBy: 'USER',
        dependsOn: [],
        autoCompleteRule: null,
        requiredForStatus: 'PROVISIONAL',
        dueDateRule: { basis: 'bookingDate', offsetDays: -30 },
      });
      expect(seeds[0]).not.toHaveProperty('state');
      expect(seeds[0]).not.toHaveProperty('completedAt');
      expect(seeds[0]).not.toHaveProperty('dueDate');
    });

    it('skips checklist seeding when the source has no (non-skipped) items', async () => {
      repo.findOneForClone.mockResolvedValue(sourceForClone({ seriesId: null, checklistItems: [] }));
      repo.cloneBookingCore.mockResolvedValue({ ...newBooking, seriesId: null });
      await service.copyBooking('u1', 'src', { date: '2026-09-15' });
      expect(checklistRepo.seedChecklistItems).not.toHaveBeenCalled();
    });

    it('guards membership mutability and appends the series invoice line when copying into a series', async () => {
      repo.findOneForClone.mockResolvedValue(sourceForClone());
      repo.cloneBookingCore.mockResolvedValue(newBooking);
      await service.copyBooking('u1', 'src', { date: '2026-09-15' });
      expect(seriesService.assertMembershipMutable).toHaveBeenCalledWith('u1', 's1');
      expect(seriesService.syncMemberJoin).toHaveBeenCalledWith('u1', 's1', expect.objectContaining({ id: 'copy1' }), TX);
    });

    it('does not touch series machinery for a non-series booking', async () => {
      repo.findOneForClone.mockResolvedValue(sourceForClone({ seriesId: null }));
      repo.cloneBookingCore.mockResolvedValue({ ...newBooking, seriesId: null });
      await service.copyBooking('u1', 'src', { date: '2026-09-15' });
      expect(seriesService.assertMembershipMutable).not.toHaveBeenCalled();
      expect(seriesService.syncMemberJoin).not.toHaveBeenCalled();
    });

    it('enrols the clone + checklist + series writes in a single transaction (ADR-0047)', async () => {
      repo.findOneForClone.mockResolvedValue(sourceForClone());
      repo.cloneBookingCore.mockResolvedValue(newBooking);
      await service.copyBooking('u1', 'src', { date: '2026-09-15' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(repo.cloneBookingCore).toHaveBeenCalledWith('u1', expect.anything(), expect.any(Date), TX);
      expect(checklistRepo.seedChecklistItems).toHaveBeenCalledWith('u1', 'copy1', expect.any(Array), newBooking.date, newBooking.createdAt, TX);
      expect(seriesService.syncMemberJoin).toHaveBeenCalledWith('u1', 's1', expect.anything(), TX);
    });
  });

  describe('update', () => {
    it('updates and returns result when booking exists', async () => {
      repo.findOne.mockResolvedValue(booking);
      const updated = { ...booking, status: BookingStatus.CONFIRMED, date: new Date(), createdAt: new Date() };
      repo.update.mockResolvedValue(updated);
      const result = await service.update('u1', 'b1', { status: BookingStatus.CONFIRMED });
      expect(repo.update).toHaveBeenCalledWith('b1', { status: BookingStatus.CONFIRMED });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException without calling update when booking is not found', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.update('u1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('recomputes checklist due dates when date changes', async () => {
      const newDate = '2027-01-01';
      const updated = { ...booking, date: new Date(newDate), createdAt: new Date() };
      repo.findOne.mockResolvedValue(booking);
      repo.update.mockResolvedValue(updated);
      await service.update('u1', 'b1', { date: newDate });
      expect(checklistRepo.recomputeChecklistDueDates).toHaveBeenCalledWith('b1', updated.date, updated.createdAt);
    });

    it('does not recompute checklist due dates when date does not change', async () => {
      const updated = { ...booking, date: new Date(), createdAt: new Date() };
      repo.findOne.mockResolvedValue(booking);
      repo.update.mockResolvedValue(updated);
      await service.update('u1', 'b1', { status: BookingStatus.CONFIRMED });
      expect(checklistRepo.recomputeChecklistDueDates).not.toHaveBeenCalled();
    });

    it('re-evaluates auto-complete rules when venueId changes (auto-completes add_venue — #511)', async () => {
      const updated = { ...booking, date: new Date(), createdAt: new Date() };
      repo.findOne.mockResolvedValue(booking);
      repo.update.mockResolvedValue(updated);
      await service.update('u1', 'b1', { venueId: 'venue-1' });
      expect(evaluator.evaluate).toHaveBeenCalledWith('b1');
    });

    it('does not re-evaluate when neither status nor venueId change', async () => {
      const updated = { ...booking, date: new Date(), createdAt: new Date() };
      repo.findOne.mockResolvedValue(booking);
      repo.update.mockResolvedValue(updated);
      await service.update('u1', 'b1', { title: 'New title' });
      expect(evaluator.evaluate).not.toHaveBeenCalled();
    });

    it('round-trips logistics without modification', async () => {
      const logistics = {
        arrivalTime:    { value: '14:00', shareWithBand: true,  shareWithClient: false },
        soundCheckTime: { value: '15:00', shareWithBand: false, shareWithClient: false },
      };
      const updated = { ...booking, date: new Date(), createdAt: new Date(), logistics };
      repo.findOne.mockResolvedValue(booking);
      repo.update.mockResolvedValue(updated);
      const result = await service.update('u1', 'b1', { logistics });
      expect(repo.update).toHaveBeenCalledWith('b1', { logistics });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).logistics).toBe(logistics);
    });
  });

  describe('delete', () => {
    it('cancels the booking when it exists', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.cancel.mockResolvedValue({ ...booking, status: BookingStatus.CANCELLED });
      await service.delete('u1', 'b1');
      expect(repo.cancel).toHaveBeenCalledWith('b1');
    });

    it('throws NotFoundException without cancelling when booking is not found', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.cancel).not.toHaveBeenCalled();
    });
  });

  describe('applyPackageTemplate', () => {
    const rawBooking = { ...booking, musicFormConfig: null, musicFormResponse: null, packages: [] };

    it('applies a template when booking and template both exist', async () => {
      const tmpl = { id: 'f1', label: 'Ceremony', icon: 'heart', keyMoments: [], defaultGenreSelection: [], slots: [] };
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findPackageTemplates.mockResolvedValue([tmpl]);
      repo.applyPackageTemplate.mockResolvedValue(rawBooking);
      await service.applyPackageTemplate('u1', 'b1', 'f1');
      expect(repo.applyPackageTemplate).toHaveBeenCalledWith('u1', 'b1', tmpl);
    });

    it('triggers evaluate after applying (so build_itinerary auto-completes for template-seeded sets — Story 21)', async () => {
      const tmpl = { id: 'f1', label: 'Ceremony', icon: 'heart', keyMoments: [], defaultGenreSelection: [], slots: [] };
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findPackageTemplates.mockResolvedValue([tmpl]);
      repo.applyPackageTemplate.mockResolvedValue(rawBooking);
      await service.applyPackageTemplate('u1', 'b1', 'f1');
      expect(evaluator.evaluate).toHaveBeenCalledWith('b1');
    });

    it('offers the template key moments/genres as a suggestion when the form is on, without forcing them (ADR-0046 / #502)', async () => {
      const tmpl = {
        id: 'f1', label: 'Ceremony', icon: 'heart',
        keyMoments: ['Processional', 'First dance'],
        defaultGenreSelection: ['JAZZ'], slots: [],
      };
      // Form on: the applied booking carries a musicFormConfig.
      const onBooking = { ...rawBooking, musicFormConfig: { id: 'mfc1' } };
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findPackageTemplates.mockResolvedValue([tmpl]);
      repo.applyPackageTemplate.mockResolvedValue(onBooking);

      const result = await service.applyPackageTemplate('u1', 'b1', 'f1');

      expect(result.suggestion).toEqual({
        keyMoments: [
          { label: 'Processional', section: 'Ceremony' },
          { label: 'First dance', section: 'Ceremony' },
        ],
        genres: ['JAZZ'],
      });
      // "Suggest, not force": the config is never written by applying.
      expect(musicFormRepo.upsertMusicFormConfig).not.toHaveBeenCalled();
    });

    it('returns no suggestion when the music form is off', async () => {
      const tmpl = {
        id: 'f1', label: 'Ceremony', icon: 'heart',
        keyMoments: ['Processional'], defaultGenreSelection: ['JAZZ'], slots: [],
      };
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findPackageTemplates.mockResolvedValue([tmpl]);
      repo.applyPackageTemplate.mockResolvedValue(rawBooking); // musicFormConfig: null

      const result = await service.applyPackageTemplate('u1', 'b1', 'f1');

      expect(result.suggestion).toBeNull();
      expect(musicFormRepo.upsertMusicFormConfig).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when template is not found', async () => {
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findPackageTemplates.mockResolvedValue([]);
      await expect(service.applyPackageTemplate('u1', 'b1', 'bad-id')).rejects.toThrow(NotFoundException);
      expect(repo.applyPackageTemplate).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when booking is not found', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.applyPackageTemplate('u1', 'missing', 'f1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removePackage', () => {
    const rawBooking = { ...booking, musicFormConfig: null, musicFormResponse: null, packages: [] };

    it('removes a package when booking and package both exist', async () => {
      const bookingPackage = { id: 'pkg1', label: 'Ceremony', icon: 'heart', order: 1 };
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findBookingPackage.mockResolvedValue(bookingPackage);
      repo.removePackage.mockResolvedValue(rawBooking);
      await service.removePackage('u1', 'b1', 'pkg1');
      // The package label is threaded so the repo can move its key moments to "Other" (#502).
      expect(repo.removePackage).toHaveBeenCalledWith('b1', 'pkg1', 'Ceremony');
    });

    it('throws NotFoundException when package is not found', async () => {
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findBookingPackage.mockResolvedValue(null);
      await expect(service.removePackage('u1', 'b1', 'pkg1')).rejects.toThrow(NotFoundException);
      expect(repo.removePackage).not.toHaveBeenCalled();
    });
  });

  describe('updatePackage', () => {
    const rawBooking = { ...booking, musicFormConfig: null, musicFormResponse: null, packages: [] };

    it('updates a booking-owned package when booking and package both exist', async () => {
      const bookingPackage = { id: 'pkg1', label: 'Ceremony', icon: 'heart', order: 1 };
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findBookingPackage.mockResolvedValue(bookingPackage);
      repo.updatePackage.mockResolvedValue(rawBooking);
      await service.updatePackage('u1', 'b1', 'pkg1', { label: 'Evening', icon: 'music' });
      expect(repo.updatePackage).toHaveBeenCalledWith('b1', 'pkg1', { label: 'Evening', icon: 'music' });
    });

    it('throws NotFoundException when package is not found', async () => {
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findBookingPackage.mockResolvedValue(null);
      await expect(service.updatePackage('u1', 'b1', 'pkg1', { label: 'X' })).rejects.toThrow(NotFoundException);
      expect(repo.updatePackage).not.toHaveBeenCalled();
    });
  });

  describe('addSet', () => {
    it('adds a set when the booking exists', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.addSet.mockResolvedValue(set);
      const dto = { order: 1, duration: 60 };
      const result = await service.addSet('u1', 'b1', dto);
      expect(repo.addSet).toHaveBeenCalledWith('u1', 'b1', dto);
      expect(result).toBe(set);
    });

    it('throws NotFoundException without adding when booking is not found', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.addSet('u1', 'missing', { order: 1, duration: 60 })).rejects.toThrow(NotFoundException);
      expect(repo.addSet).not.toHaveBeenCalled();
    });

    it('triggers evaluate after adding (so build_itinerary can auto-complete — Story 21)', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.addSet.mockResolvedValue(set);
      await service.addSet('u1', 'b1', { order: 1, duration: 60 });
      expect(evaluator.evaluate).toHaveBeenCalledWith('b1');
    });
  });

  describe('updateSet', () => {
    it('updates the set when booking and set both exist', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(set);
      const updated = { ...set, duration: 90 };
      repo.updateSet.mockResolvedValue(updated);
      const result = await service.updateSet('u1', 'b1', 's1', { duration: 90 });
      expect(repo.updateSet).toHaveBeenCalledWith('s1', { duration: 90 });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when the booking is not found', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.updateSet('u1', 'missing', 's1', {})).rejects.toThrow(NotFoundException);
      expect(repo.updateSet).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the set is not found on the booking', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(null);
      await expect(service.updateSet('u1', 'b1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.updateSet).not.toHaveBeenCalled();
    });

    it('scopes set lookup to the correct booking and user', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(set);
      repo.updateSet.mockResolvedValue(set);
      await service.updateSet('u1', 'b1', 's1', {});
      expect(repo.findSet).toHaveBeenCalledWith('u1', 'b1', 's1');
    });

    // Re-parenting (#521): moving a set between packages persists packageId as a set-row change.
    it('re-parents the set to a package on the same booking', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(set);
      repo.findBookingPackage.mockResolvedValue({ id: 'pkg1', bookingId: 'b1' });
      const moved = { ...set, packageId: 'pkg1' };
      repo.updateSet.mockResolvedValue(moved);
      const result = await service.updateSet('u1', 'b1', 's1', { packageId: 'pkg1' });
      expect(repo.findBookingPackage).toHaveBeenCalledWith('u1', 'b1', 'pkg1');
      expect(repo.updateSet).toHaveBeenCalledWith('s1', { packageId: 'pkg1' });
      expect(result).toBe(moved);
    });

    it('ungroups the set when packageId is null — no package lookup needed', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(set);
      repo.updateSet.mockResolvedValue({ ...set, packageId: null });
      await service.updateSet('u1', 'b1', 's1', { packageId: null });
      expect(repo.findBookingPackage).not.toHaveBeenCalled();
      expect(repo.updateSet).toHaveBeenCalledWith('s1', { packageId: null });
    });

    it('rejects re-parenting to a package that is not on this booking', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(set);
      repo.findBookingPackage.mockResolvedValue(null);
      await expect(service.updateSet('u1', 'b1', 's1', { packageId: 'other-booking-pkg' })).rejects.toThrow(NotFoundException);
      expect(repo.updateSet).not.toHaveBeenCalled();
    });
  });

  describe('deleteSet', () => {
    it('deletes the set when booking and set both exist', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(set);
      repo.deleteSet.mockResolvedValue(set);
      await service.deleteSet('u1', 'b1', 's1');
      expect(repo.deleteSet).toHaveBeenCalledWith('s1');
    });

    it('throws NotFoundException when the booking is not found', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.deleteSet('u1', 'missing', 's1')).rejects.toThrow(NotFoundException);
      expect(repo.deleteSet).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the set is not found on the booking', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(null);
      await expect(service.deleteSet('u1', 'b1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.deleteSet).not.toHaveBeenCalled();
    });
  });

  describe('getMusicFormConfig', () => {
    it('returns config when booking and config exist', async () => {
      const config = { id: 'mfc1', bookingId: 'b1' };
      repo.findOne.mockResolvedValue({ ...booking, musicFormConfig: { id: 'mfc1' }, musicFormResponse: null });
      musicFormRepo.findMusicFormConfig.mockResolvedValue(config);
      const result = await service.getMusicFormConfig('u1', 'b1');
      expect(musicFormRepo.findMusicFormConfig).toHaveBeenCalledWith('b1');
      expect(result).toBe(config);
    });

    it('throws NotFoundException when config does not exist', async () => {
      repo.findOne.mockResolvedValue({ ...booking, musicFormConfig: null, musicFormResponse: null });
      musicFormRepo.findMusicFormConfig.mockResolvedValue(null);
      await expect(service.getMusicFormConfig('u1', 'b1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when booking is not found', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.getMusicFormConfig('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(musicFormRepo.findMusicFormConfig).not.toHaveBeenCalled();
    });
  });

  describe('upsertMusicFormConfig', () => {
    const dto = { keyMoments: [{ label: 'Processional', section: 'Ceremony' }], enabledGenres: ['CONTEMPORARY'] };

    it('upserts config when booking exists', async () => {
      const config = { id: 'mfc1', bookingId: 'b1', ...dto };
      repo.findOne.mockResolvedValue({ ...booking, musicFormConfig: null, musicFormResponse: null });
      musicFormRepo.upsertMusicFormConfig.mockResolvedValue(config);
      const result = await service.upsertMusicFormConfig('u1', 'b1', dto);
      expect(musicFormRepo.upsertMusicFormConfig).toHaveBeenCalledWith('u1', 'b1', dto);
      expect(result).toBe(config);
    });

    it('throws NotFoundException when booking is not found', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.upsertMusicFormConfig('u1', 'missing', dto)).rejects.toThrow(NotFoundException);
      expect(musicFormRepo.upsertMusicFormConfig).not.toHaveBeenCalled();
    });
  });

  describe('getChecklist', () => {
    const now = new Date('2026-05-27T12:00:00Z');
    const checklistItems = [
      {
        id: 'ci1', userId: 'u1', bookingId: 'b1', createdAt: now, updatedAt: now,
        key: 'send_quote', label: 'Send quote', completedBy: 'USER', state: 'PENDING',
        order: 1, dependsOn: [], autoCompleteRule: null, requiredForStatus: null,
        completedAt: null, dueDate: null, dueDateRule: null,
      },
      {
        id: 'ci2', userId: 'u1', bookingId: 'b1', createdAt: now, updatedAt: now,
        key: 'send_contract', label: 'Send contract & deposit email', completedBy: 'USER', state: 'BLOCKED',
        order: 4, dependsOn: ['create_contract'], autoCompleteRule: null, requiredForStatus: 'CONFIRMED',
        completedAt: null, dueDate: new Date('2026-06-01'), dueDateRule: null,
      },
    ];

    it('returns checklist items with ISO date strings', async () => {
      repo.findOne.mockResolvedValue({ ...booking, musicFormConfig: null, musicFormResponse: null, contracts: [] });
      repo.findChecklistItems.mockResolvedValue(checklistItems);
      const result = await service.getChecklist('u1', 'b1');
      expect(repo.findChecklistItems).toHaveBeenCalledWith('u1', 'b1');
      expect(result[0].createdAt).toBe(now.toISOString());
      expect(result[1].dueDate).toBe(new Date('2026-06-01').toISOString());
      expect(result[0].dueDate).toBeNull();
    });

    it('throws NotFoundException when booking does not exist', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.getChecklist('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.findChecklistItems).not.toHaveBeenCalled();
    });

    it('derives a shortcut on each step of a multi-step goal (ADR-0057 / #611)', async () => {
      // A multi-step goal carries no goal-level rule — its action lives on the active step,
      // so the active step must route exactly like an atomic item. Assert the steps' derived
      // shortcuts (create → create_contract, send → send_email; AWAITED signed → mark).
      const contractGoal = {
        id: 'cg1', userId: 'u1', bookingId: 'b1', createdAt: now, updatedAt: now,
        key: 'get_contract_signed', label: 'Get the contract signed', completedBy: 'USER',
        state: 'PENDING', order: 2, dependsOn: [], autoCompleteRule: null,
        requiredForStatus: 'CONFIRMED', completedAt: null, dueDate: null, dueDateRule: null,
        steps: [
          {
            id: 's1', key: 'create_contract', label: 'Draft the contract', order: 1,
            kind: 'MILESTONE', completeMode: 'ACTION', state: 'COMPLETE', completedBy: 'USER',
            completedAt: now,
            autoCompleteRule: { type: 'bookingField', field: 'activeContract', operator: 'notNull' },
          },
          {
            id: 's2', key: 'send_contract', label: 'Send it to the client', order: 2,
            kind: 'MILESTONE', completeMode: 'ACTION', state: 'PENDING', completedBy: 'USER',
            completedAt: null,
            autoCompleteRule: { type: 'communicationSent', templateTypes: ['contract_cover', 'contract_and_deposit_cover'] },
          },
          {
            id: 's3', key: 'contract_signed', label: 'Client signs the contract', order: 3,
            kind: 'MILESTONE', completeMode: 'AWAITED', state: 'PENDING', completedBy: 'CUSTOMER',
            completedAt: null, autoCompleteRule: { type: 'contractSigned' },
          },
        ],
      };
      repo.findOne.mockResolvedValue({ ...booking, musicFormConfig: null, musicFormResponse: null, contracts: [] });
      repo.findChecklistItems.mockResolvedValue([contractGoal]);

      const result = await service.getChecklist('u1', 'b1');
      const steps = result[0].steps!;
      expect(steps[0].shortcutType).toBe('create_contract');
      expect(steps[1].shortcutType).toBe('send_email');
      expect(steps[1].shortcutTemplateType).toBe('contract_cover');
      expect(steps[2].shortcutType).toBe('mark_contract_signed');
      // The goal itself rolls up — no goal-level shortcut.
      expect(result[0].shortcutType).toBeUndefined();
    });
  });

  describe('createContract', () => {
    const rawBooking = { ...booking, musicFormConfig: null, musicFormResponse: null, contracts: [] };
    const now = new Date('2026-05-27T12:00:00Z');

    const contractTemplate = {
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'This agreement is between ' },
              { type: 'variable', attrs: { name: 'customerName' } },
              { type: 'text', text: ' and ' },
              { type: 'variable', attrs: { name: 'musicianName' } },
              { type: 'text', text: '.' },
            ],
          },
        ],
      },
    };

    const mockContract = {
      id: 'c1',
      userId: 'u1',
      bookingId: 'b1',
      status: 'DRAFT',
      content: {},
      createdAt: now,
      updatedAt: now,
      signedAt: null,
    };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(rawBooking);
      contractRepo.findContractTemplate.mockResolvedValue(contractTemplate);
      mail.buildContext.mockResolvedValue(baseContext);
      contractRepo.findActiveContract.mockResolvedValue(null);
      contractRepo.createContractRecord.mockResolvedValue(mockContract);
    });

    it('substitutes variables and creates a Contract record', async () => {
      const result = await service.createContract('u1', 'b1');

      expect(contractRepo.findContractTemplate).toHaveBeenCalledWith('u1');
      expect(mail.buildContext).toHaveBeenCalledWith('u1', 'b1');
      expect(contractRepo.createContractRecord).toHaveBeenCalledWith('u1', 'b1', expect.any(Object));
      expect(result.content).toBeDefined();
    });

    it('replaces variable chip nodes with plain text in the stored content', async () => {
      contractRepo.createContractRecord.mockImplementation((_u, _b, content) =>
        Promise.resolve({ ...mockContract, content }),
      );
      const result = await service.createContract('u1', 'b1');

      const json = JSON.stringify(result.content);
      expect(json).not.toContain('"type":"variable"');
      expect(json).toContain('Jane Smith');
      expect(json).toContain('Tim Stanton');
    });

    it('voids existing active contract before creating new one', async () => {
      const existing = { id: 'old-contract' };
      contractRepo.findActiveContract.mockResolvedValue(existing);
      contractRepo.voidContract.mockResolvedValue({});

      await service.createContract('u1', 'b1');

      expect(contractRepo.voidContract).toHaveBeenCalledWith('old-contract');
      expect(contractRepo.createContractRecord).toHaveBeenCalled();
    });

    it('throws NotFoundException when the booking does not exist', async () => {
      repo.findForOwnership.mockResolvedValue(null);
      await expect(service.createContract('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(contractRepo.findContractTemplate).not.toHaveBeenCalled();
      expect(contractRepo.createContractRecord).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no contract template exists', async () => {
      contractRepo.findContractTemplate.mockResolvedValue(null);
      await expect(service.createContract('u1', 'b1')).rejects.toThrow(NotFoundException);
      expect(contractRepo.createContractRecord).not.toHaveBeenCalled();
    });

    it('does not mutate the original template content', async () => {
      const originalContent = JSON.parse(JSON.stringify(contractTemplate.content));
      await service.createContract('u1', 'b1');
      expect(contractTemplate.content).toEqual(originalContent);
    });
  });

  describe('sendContract', () => {
    const now = new Date('2026-05-27T12:00:00Z');
    const draftContract = { id: 'c1', userId: 'u1', bookingId: 'b1', status: 'DRAFT', content: {}, createdAt: now, updatedAt: now, signedAt: null };
    const rawBooking = { ...booking, musicFormConfig: null, musicFormResponse: null, contracts: [] };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(rawBooking);
      contractRepo.findContractById.mockResolvedValue(draftContract);
      contractRepo.markContractSent.mockResolvedValue({ ...draftContract, status: 'SENT' });
    });

    it('transitions a DRAFT contract to SENT', async () => {
      const result = await service.sendContract('u1', 'b1', 'c1');
      expect(contractRepo.markContractSent).toHaveBeenCalledWith('c1');
      expect(result.status).toBe('SENT');
    });

    it('throws BadRequestException when contract is not DRAFT', async () => {
      contractRepo.findContractById.mockResolvedValue({ ...draftContract, status: 'SENT' });
      await expect(service.sendContract('u1', 'b1', 'c1')).rejects.toThrow(BadRequestException);
      expect(contractRepo.markContractSent).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when contract does not exist', async () => {
      contractRepo.findContractById.mockResolvedValue(null);
      await expect(service.sendContract('u1', 'b1', 'c1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('voidContract', () => {
    const now = new Date('2026-05-27T12:00:00Z');
    const sentContract = { id: 'c1', userId: 'u1', bookingId: 'b1', status: 'SENT', content: {}, createdAt: now, updatedAt: now, signedAt: null };
    const rawBooking = { ...booking, musicFormConfig: null, musicFormResponse: null, contracts: [] };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(rawBooking);
      contractRepo.findContractById.mockResolvedValue(sentContract);
      contractRepo.voidContract.mockResolvedValue({ ...sentContract, status: 'VOID' });
    });

    it('voids a non-SIGNED contract without confirmation', async () => {
      await service.voidContract('u1', 'b1', 'c1');
      expect(contractRepo.voidContract).toHaveBeenCalledWith('c1');
    });

    it('throws BadRequestException when voiding a SIGNED contract without confirmation', async () => {
      contractRepo.findContractById.mockResolvedValue({ ...sentContract, status: 'SIGNED' });
      await expect(service.voidContract('u1', 'b1', 'c1')).rejects.toThrow(BadRequestException);
      expect(contractRepo.voidContract).not.toHaveBeenCalled();
    });

    it('voids a SIGNED contract when confirmSignedVoid is true', async () => {
      contractRepo.findContractById.mockResolvedValue({ ...sentContract, status: 'SIGNED' });
      await service.voidContract('u1', 'b1', 'c1', true);
      expect(contractRepo.voidContract).toHaveBeenCalledWith('c1');
    });

    it('throws BadRequestException when contract is already VOID', async () => {
      contractRepo.findContractById.mockResolvedValue({ ...sentContract, status: 'VOID' });
      await expect(service.voidContract('u1', 'b1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when contract does not exist', async () => {
      contractRepo.findContractById.mockResolvedValue(null);
      await expect(service.voidContract('u1', 'b1', 'c1')).rejects.toThrow(NotFoundException);
    });

    it('allows void-then-recreate flow: voiding clears the way for a new contract', async () => {
      await service.voidContract('u1', 'b1', 'c1');
      expect(contractRepo.voidContract).toHaveBeenCalledWith('c1');

      // New contract can now be created
      contractRepo.findContractTemplate.mockResolvedValue({ content: { type: 'doc', content: [] } });
      mail.buildContext.mockResolvedValue(baseContext);
      contractRepo.findActiveContract.mockResolvedValue(null);
      contractRepo.createContractRecord.mockResolvedValue({ ...sentContract, id: 'c2', status: 'DRAFT' });

      const newContract = await service.createContract('u1', 'b1');
      expect(newContract.status).toBe('DRAFT');
    });
  });

  describe('updateSeries', () => {
    const series = { id: 's1', customerId: 'c1', customer: { name: 'Hotel X' } };
    const bookingWithCustomer = {
      ...booking,
      customer: { id: 'c1', name: 'Jane Smith' },
      customerId: 'c1',
      musicFormConfig: null, musicFormResponse: null, contracts: [],
    };
    const bookingDifferentCustomer = {
      ...bookingWithCustomer,
      customerId: 'c2',
      customer: { id: 'c2', name: 'Other Person' },
    };

    it('assigns booking to series when customers match', async () => {
      repo.findOne.mockResolvedValue(bookingWithCustomer);
      seriesRepo.findOneLight.mockResolvedValue(series);
      (repo.countNonVoidInvoices as jest.Mock).mockResolvedValue(0);
      (repo.updateSeries as jest.Mock).mockResolvedValue({ ...bookingWithCustomer, seriesId: 's1' });

      await service.updateSeries('u1', 'b1', 's1');
      expect(repo.updateSeries).toHaveBeenCalledWith('b1', 's1');
    });

    it('throws ConflictException when booking has non-VOID invoices', async () => {
      repo.findOne.mockResolvedValue(bookingWithCustomer);
      seriesRepo.findOneLight.mockResolvedValue(series);
      (repo.countNonVoidInvoices as jest.Mock).mockResolvedValue(2);

      await expect(service.updateSeries('u1', 'b1', 's1')).rejects.toThrow(ConflictException);
      expect(repo.updateSeries).not.toHaveBeenCalled();
    });

    it('returns requiresConfirmation when customers differ without confirm flag', async () => {
      repo.findOne.mockResolvedValue(bookingDifferentCustomer);
      seriesRepo.findOneLight.mockResolvedValue(series);
      (repo.countNonVoidInvoices as jest.Mock).mockResolvedValue(0);

      const result = await service.updateSeries('u1', 'b1', 's1');
      expect((result as { requiresConfirmation: boolean }).requiresConfirmation).toBe(true);
      expect(repo.updateSeries).not.toHaveBeenCalled();
    });

    it('assigns when customers differ but confirm is true', async () => {
      repo.findOne.mockResolvedValue(bookingDifferentCustomer);
      seriesRepo.findOneLight.mockResolvedValue(series);
      (repo.countNonVoidInvoices as jest.Mock).mockResolvedValue(0);
      (repo.updateSeries as jest.Mock).mockResolvedValue({ ...bookingDifferentCustomer, seriesId: 's1' });

      await service.updateSeries('u1', 'b1', 's1', true);
      expect(repo.updateSeries).toHaveBeenCalledWith('b1', 's1');
    });

    it('removes from series when seriesId is null', async () => {
      repo.findOne.mockResolvedValue(bookingWithCustomer);
      (repo.updateSeries as jest.Mock).mockResolvedValue({ ...bookingWithCustomer, seriesId: null });

      await service.updateSeries('u1', 'b1', null);
      expect(repo.updateSeries).toHaveBeenCalledWith('b1', null);
      expect(repo.countNonVoidInvoices).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when series not found', async () => {
      repo.findOne.mockResolvedValue(bookingWithCustomer);
      seriesRepo.findOneLight.mockResolvedValue(null);

      await expect(service.updateSeries('u1', 'b1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('creates a new series and assigns the booking when newSeriesLabel is provided', async () => {
      const newSeries = { id: 'new-s1', customerId: 'c1', customer: { name: 'Jane Smith' } };
      repo.findOne.mockResolvedValue(bookingWithCustomer);
      seriesRepo.create.mockResolvedValue(newSeries);
      seriesRepo.findOneLight.mockResolvedValue(newSeries);
      (repo.countNonVoidInvoices as jest.Mock).mockResolvedValue(0);
      (repo.updateSeries as jest.Mock).mockResolvedValue({ ...bookingWithCustomer, seriesId: 'new-s1' });

      await service.updateSeries('u1', 'b1', null, undefined, 'Hotel Grand Events');

      expect(seriesRepo.create).toHaveBeenCalledWith('u1', 'Hotel Grand Events', 'c1');
      expect(repo.updateSeries).toHaveBeenCalledWith('b1', 'new-s1');
    });
  });

  describe('updateChecklistItem', () => {
    it('clears depositReceivedAt when deposit_received is un-marked to PENDING', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findChecklistItemById.mockResolvedValue({ id: 'i1', key: 'deposit_received' });
      checklistRepo.updateChecklistItemState.mockResolvedValue({ count: 1 });
      repo.findChecklistItems.mockResolvedValue([]);

      await service.updateChecklistItem('u1', 'b1', 'i1', 'PENDING');

      expect(repo.clearDepositReceivedAt).toHaveBeenCalledWith('b1');
      expect(repo.setDepositReceivedAt).not.toHaveBeenCalled();
    });

    it('sets depositReceivedAt when deposit_received is marked COMPLETE', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findChecklistItemById.mockResolvedValue({ id: 'i1', key: 'deposit_received' });
      checklistRepo.updateChecklistItemState.mockResolvedValue({ count: 1 });
      repo.findChecklistItems.mockResolvedValue([]);

      await service.updateChecklistItem('u1', 'b1', 'i1', 'COMPLETE');

      expect(repo.setDepositReceivedAt).toHaveBeenCalledWith('b1', expect.any(Date));
      expect(repo.clearDepositReceivedAt).not.toHaveBeenCalled();
    });

    it('does NOT clear depositReceivedAt when deposit_received is SKIPPED (opt-out is not an un-tick)', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findChecklistItemById.mockResolvedValue({ id: 'i1', key: 'deposit_received' });
      checklistRepo.updateChecklistItemState.mockResolvedValue({ count: 1 });
      repo.findChecklistItems.mockResolvedValue([]);

      await service.updateChecklistItem('u1', 'b1', 'i1', 'SKIPPED');

      expect(repo.clearDepositReceivedAt).not.toHaveBeenCalled();
      expect(repo.setDepositReceivedAt).not.toHaveBeenCalled();
    });

    it('returns the recomputed checklist (post-evaluate) so the toggle settles in one round-trip', async () => {
      const callOrder: string[] = [];
      repo.findOne.mockResolvedValue(booking);
      repo.findChecklistItemById.mockResolvedValue({ id: 'i1', key: null });
      checklistRepo.updateChecklistItemState.mockResolvedValue({ count: 1 });
      evaluator.evaluate.mockImplementation(async () => {
        callOrder.push('evaluate');
      });
      repo.findChecklistItems.mockImplementation(async () => {
        callOrder.push('read');
        return [
          {
            id: 'i1',
            key: null,
            label: 'Item',
            state: 'COMPLETE',
            order: 0,
            dependsOn: [],
            autoCompleteRule: null,
            completedAt: new Date('2025-06-01T00:00:00.000Z'),
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            updatedAt: new Date('2025-01-02T00:00:00.000Z'),
            dueDate: null,
          },
        ];
      });

      const result = await service.updateChecklistItem('u1', 'b1', 'i1', 'COMPLETE');

      // evaluate() must run before the read so the returned array already reflects the cascade.
      expect(callOrder).toEqual(['evaluate', 'read']);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'i1', state: 'COMPLETE', completedAt: '2025-06-01T00:00:00.000Z' });
    });
  });

  describe('enableReminder', () => {
    const bookingWithDates = {
      id: 'b1',
      userId: 'u1',
      status: BookingStatus.CONFIRMED,
      date: new Date('2025-06-01T19:00:00.000Z'),
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    };

    it('un-skips an existing SKIPPED reminder rather than re-seeding', async () => {
      repo.findOne.mockResolvedValue(bookingWithDates);
      checklistRepo.findItemByKey.mockResolvedValue({ id: 'ci1', state: 'SKIPPED' });

      await service.enableReminder('u1', 'b1', 'add_venue');

      expect(checklistRepo.updateChecklistItemState).toHaveBeenCalledWith('u1', 'b1', 'ci1', 'PENDING');
      expect(checklistRepo.seedReminderItem).not.toHaveBeenCalled();
      expect(evaluator.evaluate).toHaveBeenCalledWith('b1');
    });

    it('is a no-op when the reminder already exists and is not skipped', async () => {
      repo.findOne.mockResolvedValue(bookingWithDates);
      checklistRepo.findItemByKey.mockResolvedValue({ id: 'ci1', state: 'PENDING' });

      await service.enableReminder('u1', 'b1', 'add_venue');

      expect(checklistRepo.updateChecklistItemState).not.toHaveBeenCalled();
      expect(checklistRepo.seedReminderItem).not.toHaveBeenCalled();
    });

    it('on-demand seeds the reminder when no record exists', async () => {
      repo.findOne.mockResolvedValue(bookingWithDates);
      checklistRepo.findItemByKey.mockResolvedValue(null);

      await service.enableReminder('u1', 'b1', 'add_venue');

      expect(checklistRepo.seedReminderItem).toHaveBeenCalledWith(
        'u1',
        'b1',
        'add_venue',
        bookingWithDates.date,
        bookingWithDates.createdAt,
      );
      expect(evaluator.evaluate).toHaveBeenCalledWith('b1');
    });
  });

  describe('getApplicableReminders', () => {
    it('returns the selector output, with a not-yet-seeded reminder as off/discoverable', async () => {
      repo.findOne.mockResolvedValue({ ...booking, status: BookingStatus.CONFIRMED });
      repo.findChecklistItemsForReminders.mockResolvedValue([]);
      repo.findUserProfile.mockResolvedValue(null);

      const result = await service.getApplicableReminders('u1', 'b1', 'venue');

      // add_venue (READY-staged) is current/future on a CONFIRMED booking, not yet seeded.
      const addVenue = result.find((r) => r.key === 'add_venue');
      expect(addVenue).toMatchObject({ on: false, itemId: null, source: 'system' });
    });

    it('drops a globally-disabled reminder, resolved from the profile template', async () => {
      repo.findOne.mockResolvedValue({ ...booking, status: BookingStatus.ENQUIRY });
      repo.findChecklistItemsForReminders.mockResolvedValue([]);
      repo.findUserProfile.mockResolvedValue({
        preferences: {
          checklistDefaults: [{ key: 'send_quote', enabled: false, label: 'Send quote' }],
        },
      });

      const result = await service.getApplicableReminders('u1', 'b1', 'people');

      expect(result.find((r) => r.key === 'send_quote')).toBeUndefined();
    });
  });

  describe('previewReminders (pre-creation, #560)', () => {
    it('previews the system reminders for the starting status, no booking required', async () => {
      repo.findUserProfile.mockResolvedValue(null);

      const result = await service.previewReminders('u1', 'PROVISIONAL');

      // No findOne / findChecklistItemsForReminders — preview runs off the template alone.
      expect(repo.findOne).not.toHaveBeenCalled();
      // send_thank_you (people) depends cross-concern on play_the_gig (overview) — the surviving
      // cross-concern prerequisite after the quote/deposit/balance/song clusters collapsed into
      // goals (ADR-0057 / #607–#608 / #616), whose intra-goal deps retired.
      const thankYou = result.find((r) => r.key === 'send_thank_you');
      expect(thankYou).toMatchObject({ concern: 'people' });
      expect(thankYou?.prerequisites).toContainEqual({ key: 'play_the_gig', phrase: 'play the gig' });
      // The song-request deliverable is now one multi-step goal in Music.
      expect(result.find((r) => r.key === 'gather_song_requests')).toMatchObject({ concern: 'music' });
    });

    it('drops a template-disabled key (master switch parity with the Builder)', async () => {
      repo.findUserProfile.mockResolvedValue({
        preferences: {
          checklistDefaults: [
            { key: 'get_the_quote_accepted', enabled: false, label: 'Get the quote accepted' },
          ],
        },
      });

      const result = await service.previewReminders('u1', 'ENQUIRY');

      expect(result.find((r) => r.key === 'get_the_quote_accepted')).toBeUndefined();
    });
  });
});
