import { BookingStatus } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  booking: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  performanceSet: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  package: {
    findMany: jest.Mock;
  };
};

function makePrisma(): MockPrisma {
  return {
    booking: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    performanceSet: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    package: {
      findMany: jest.fn(),
    },
  };
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
  });

  describe('findOne', () => {
    it('queries by id and userId with no status filter', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 'b1');
      expect(prisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b1', userId: 'u1' } }),
      );
    });

    it('includes customer, venue, bookingAgent, and sets', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 'b1');
      const include = prisma.booking.findFirst.mock.calls[0][0].include;
      expect(include).toMatchObject({
        customer: true,
        venue: true,
        bookingAgent: true,
        sets: expect.anything(),
      });
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
  });

  describe('findFormats', () => {
    it('queries by userId and ids', async () => {
      prisma.package.findMany.mockResolvedValue([]);
      await repo.findFormats('u1', ['f1', 'f2']);
      expect(prisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['f1', 'f2'] }, userId: 'u1' } }),
      );
    });
  });

  describe('createWithFormats', () => {
    it('creates sets from format slots with packageId', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      const fmt = {
        id: 'f1',
        label: 'Ceremony',
        keyMoments: [],
        defaultGenreSelection: ['CONTEMPORARY'],
        slots: [{ label: 'Ceremony', duration: 30, order: 1 }],
      };
      await repo.createWithFormats('u1', { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] }, [fmt], false);
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.sets.create[0]).toMatchObject({ duration: 30, packageId: 'f1' });
    });

    it('creates musicFormConfig when formats have keyMoments and songRequestFormEnabled', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      const fmt = {
        id: 'f1',
        label: 'Wedding Ceremony',
        keyMoments: ['Processional'],
        defaultGenreSelection: ['CLASSICAL'],
        slots: [],
      };
      await repo.createWithFormats('u1', { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] }, [fmt], true);
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.musicFormConfig.create.keyMoments).toEqual([
        { label: 'Processional', section: 'Wedding Ceremony' },
      ]);
    });

    it('creates musicFormConfig with empty keyMoments when formats have none but songRequestFormEnabled', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      const fmt = { id: 'f1', label: 'Background', keyMoments: [], defaultGenreSelection: ['CONTEMPORARY'], slots: [] };
      await repo.createWithFormats('u1', { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] }, [fmt], true);
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.musicFormConfig.create.keyMoments).toEqual([]);
    });

    it('omits musicFormConfig when songRequestFormEnabled is false', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      const fmt = { id: 'f1', label: 'Background', keyMoments: [], defaultGenreSelection: [], slots: [] };
      await repo.createWithFormats('u1', { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', checklistItems: [] }, [fmt], false);
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.musicFormConfig).toBeUndefined();
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
});
