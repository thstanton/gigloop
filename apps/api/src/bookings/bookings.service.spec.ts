import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';
import { ContractRepository } from './contract.repository';
import { MusicFormConfigRepository } from './music-form-config.repository';
import { ChecklistRepository } from '../checklist/checklist.repository';
import { SeriesRepository } from '../series/series.repository';
import { MailService } from '../mail/mail.service';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import type { EmailContext } from '../mail/mail.service';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  findFormats: jest.Mock;
  createWithFormats: jest.Mock;
  findBookingFormat: jest.Mock;
  applyFormat: jest.Mock;
  removeFormat: jest.Mock;
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
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findFormats: jest.fn(),
    createWithFormats: jest.fn(),
    findBookingFormat: jest.fn(),
    applyFormat: jest.fn(),
    removeFormat: jest.fn(),
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

function makeChecklistRepo(): MockChecklistRepo {
  return {
    findActionItems: jest.fn().mockResolvedValue([]),
    seedChecklistItems: jest.fn().mockResolvedValue({ count: 10 }),
    recomputeChecklistDueDates: jest.fn().mockResolvedValue(undefined),
    updateChecklistItemState: jest.fn().mockResolvedValue({ count: 1 }),
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
  let mail: MockMail;
  let evaluator: MockEvaluator;
  let checklistRepo: MockChecklistRepo;
  let contractRepo: MockContractRepo;
  let musicFormRepo: MockMusicFormRepo;

  beforeEach(() => {
    repo = makeRepo();
    seriesRepo = makeSeriesRepo();
    mail = makeMail();
    evaluator = makeEvaluator();
    checklistRepo = makeChecklistRepo();
    contractRepo = makeContractRepo();
    musicFormRepo = makeMusicFormRepo();
    service = new BookingsService(
      repo as unknown as BookingsRepository,
      seriesRepo as unknown as SeriesRepository,
      mail as unknown as MailService,
      evaluator as unknown as ChecklistEvaluatorService,
      checklistRepo as unknown as ChecklistRepository,
      contractRepo as unknown as ContractRepository,
      musicFormRepo as unknown as MusicFormConfigRepository,
    );
  });

  describe('findAll', () => {
    it('delegates with an empty array when no status is given', async () => {
      repo.findAll.mockResolvedValue([booking]);
      const result = await service.findAll('u1');
      expect(repo.findAll).toHaveBeenCalledWith('u1', [], undefined);
      expect(result).toEqual([booking]);
    });

    it('passes a single valid status as a one-element array', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', 'CONFIRMED');
      expect(repo.findAll).toHaveBeenCalledWith('u1', ['CONFIRMED'], undefined);
    });

    it('passes multiple valid statuses as an array', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', ['CONFIRMED', 'READY']);
      expect(repo.findAll).toHaveBeenCalledWith('u1', ['CONFIRMED', 'READY'], undefined);
    });

    it('passes the search query to the repository', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', undefined, 'smith');
      expect(repo.findAll).toHaveBeenCalledWith('u1', [], 'smith');
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
  });

  describe('create', () => {
    const createdBooking = { ...booking, date: new Date('2026-06-01'), createdAt: new Date('2026-01-01') };

    it('delegates to repo.create when no formatIds provided', async () => {
      repo.create.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] };
      const result = await service.create('u1', dto);
      expect(repo.create).toHaveBeenCalledWith('u1', dto);
      expect(repo.findFormats).not.toHaveBeenCalled();
      expect(result).toBe(createdBooking);
    });

    it('seeds checklist items from dto.checklistItems', async () => {
      repo.create.mockResolvedValue(createdBooking);
      const checklistItems = [{ label: 'Send quote', key: 'send_quote', completedBy: 'USER' as const, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'PROVISIONAL' as const, dueDateRule: null }];
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems };
      await service.create('u1', dto);
      expect(checklistRepo.seedChecklistItems).toHaveBeenCalledWith(
        'u1', createdBooking.id, checklistItems, createdBooking.date, createdBooking.createdAt,
      );
    });

    it('skips seeding when checklistItems is empty', async () => {
      repo.create.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] };
      await service.create('u1', dto);
      expect(checklistRepo.seedChecklistItems).not.toHaveBeenCalled();
    });

    it('fetches formats and calls createWithFormats when formatIds provided', async () => {
      const fmt = { id: 'f1', label: 'Wedding Ceremony', keyMoments: ['Processional'], defaultGenreSelection: ['CONTEMPORARY'], slots: [] };
      repo.findFormats.mockResolvedValue([fmt]);
      repo.findUserProfile.mockResolvedValue(null);
      repo.createWithFormats.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', formatIds: ['f1'], checklistItems: [] };
      const result = await service.create('u1', dto);
      expect(repo.findFormats).toHaveBeenCalledWith('u1', ['f1']);
      expect(repo.createWithFormats).toHaveBeenCalledWith('u1', dto, [fmt], false);
      expect(result).toBe(createdBooking);
    });

    it('passes songRequestFormEnabled=true when profile has it enabled', async () => {
      const fmt = { id: 'f1', label: 'Wedding Ceremony', keyMoments: [], defaultGenreSelection: [], slots: [] };
      repo.findFormats.mockResolvedValue([fmt]);
      repo.findUserProfile.mockResolvedValue({ songRequestFormEnabled: true });
      repo.createWithFormats.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', formatIds: ['f1'], checklistItems: [] };
      await service.create('u1', dto);
      expect(repo.createWithFormats).toHaveBeenCalledWith('u1', dto, [fmt], true);
    });

    it('preserves order from formatIds when creating with formats', async () => {
      const fmt1 = { id: 'f1', label: 'A', keyMoments: [], defaultGenreSelection: [], slots: [] };
      const fmt2 = { id: 'f2', label: 'B', keyMoments: [], defaultGenreSelection: [], slots: [] };
      repo.findFormats.mockResolvedValue([fmt2, fmt1]); // reversed from DB
      repo.findUserProfile.mockResolvedValue(null);
      repo.createWithFormats.mockResolvedValue(createdBooking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', formatIds: ['f1', 'f2'], checklistItems: [] };
      await service.create('u1', dto);
      const orderedFormats = repo.createWithFormats.mock.calls[0][2];
      expect(orderedFormats[0].id).toBe('f1');
      expect(orderedFormats[1].id).toBe('f2');
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
      repo.findOne.mockResolvedValue(null);
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
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.cancel).not.toHaveBeenCalled();
    });
  });

  describe('applyFormat', () => {
    const rawBooking = { ...booking, musicFormConfig: null, musicFormResponse: null, packages: [] };

    it('applies a format when booking and format both exist', async () => {
      const fmt = { id: 'f1', label: 'Ceremony', keyMoments: [], defaultGenreSelection: [], slots: [] };
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findFormats.mockResolvedValue([fmt]);
      repo.applyFormat.mockResolvedValue(rawBooking);
      await service.applyFormat('u1', 'b1', 'f1');
      expect(repo.applyFormat).toHaveBeenCalledWith('u1', 'b1', fmt);
    });

    it('throws NotFoundException when format is not found', async () => {
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findFormats.mockResolvedValue([]);
      await expect(service.applyFormat('u1', 'b1', 'bad-id')).rejects.toThrow(NotFoundException);
      expect(repo.applyFormat).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when booking is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.applyFormat('u1', 'missing', 'f1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeFormat', () => {
    const rawBooking = { ...booking, musicFormConfig: null, musicFormResponse: null, packages: [] };

    it('removes a format when booking and bookingFormat both exist', async () => {
      const bookingFormat = { id: 'bf1', packageId: 'f1' };
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findBookingFormat.mockResolvedValue(bookingFormat);
      repo.removeFormat.mockResolvedValue(rawBooking);
      await service.removeFormat('u1', 'b1', 'bf1');
      expect(repo.removeFormat).toHaveBeenCalledWith('b1', 'bf1', 'f1');
    });

    it('throws NotFoundException when bookingFormat is not found', async () => {
      repo.findOne.mockResolvedValue(rawBooking);
      repo.findBookingFormat.mockResolvedValue(null);
      await expect(service.removeFormat('u1', 'b1', 'bf1')).rejects.toThrow(NotFoundException);
      expect(repo.removeFormat).not.toHaveBeenCalled();
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
      repo.findOne.mockResolvedValue(null);
      await expect(service.addSet('u1', 'missing', { order: 1, duration: 60 })).rejects.toThrow(NotFoundException);
      expect(repo.addSet).not.toHaveBeenCalled();
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
      repo.findOne.mockResolvedValue(null);
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
      repo.findOne.mockResolvedValue(null);
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
      repo.findOne.mockResolvedValue(null);
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
      repo.findOne.mockResolvedValue(null);
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
      repo.findOne.mockResolvedValue(null);
      await expect(service.getChecklist('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.findChecklistItems).not.toHaveBeenCalled();
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
      repo.findOne.mockResolvedValue(null);
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
  });

  describe('updateChecklistItem', () => {
    it('clears depositReceivedAt when deposit_received is un-marked to PENDING', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findChecklistItemById.mockResolvedValue({ id: 'i1', key: 'deposit_received' });
      checklistRepo.updateChecklistItemState.mockResolvedValue({ count: 1 });

      await service.updateChecklistItem('u1', 'b1', 'i1', 'PENDING');

      expect(repo.clearDepositReceivedAt).toHaveBeenCalledWith('b1');
      expect(repo.setDepositReceivedAt).not.toHaveBeenCalled();
    });

    it('sets depositReceivedAt when deposit_received is marked COMPLETE', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findChecklistItemById.mockResolvedValue({ id: 'i1', key: 'deposit_received' });
      checklistRepo.updateChecklistItemState.mockResolvedValue({ count: 1 });

      await service.updateChecklistItem('u1', 'b1', 'i1', 'COMPLETE');

      expect(repo.setDepositReceivedAt).toHaveBeenCalledWith('b1', expect.any(Date));
      expect(repo.clearDepositReceivedAt).not.toHaveBeenCalled();
    });
  });
});
