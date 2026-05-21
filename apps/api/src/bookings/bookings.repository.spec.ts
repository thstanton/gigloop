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
    it('excludes CANCELLED bookings when no status is given', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1');
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ not: BookingStatus.CANCELLED });
    });

    it('filters by the given status when one is provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1', BookingStatus.CONFIRMED);
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(BookingStatus.CONFIRMED);
    });

    it('allows CANCELLED to be explicitly requested', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      await repo.findAll('u1', BookingStatus.CANCELLED);
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.status).toBe(BookingStatus.CANCELLED);
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

    it('includes customer, venue, referrer, and sets', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 'b1');
      const include = prisma.booking.findFirst.mock.calls[0][0].include;
      expect(include).toMatchObject({
        customer: true,
        venue: true,
        referrer: true,
        sets: expect.anything(),
      });
    });
  });

  describe('create', () => {
    it('passes userId and booking fields to Prisma', async () => {
      const booking = { id: 'b1' };
      prisma.booking.create.mockResolvedValue(booking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1' };
      await repo.create('u1', dto);
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.userId).toBe('u1');
      expect(data.customerId).toBe('c1');
      expect(data.eventType).toBe('WEDDING');
    });

    it('omits fee from data when not provided', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      await repo.create('u1', { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1' });
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.fee).toBeUndefined();
    });

    it('includes fee when provided', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      await repo.create('u1', { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', fee: 1500 });
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.fee).toBe(1500);
    });

    it('creates nested sets with userId when provided', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      const sets = [{ order: 1, duration: 60, label: 'Ceremony' }];
      await repo.create('u1', { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1', sets });
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.sets.create).toEqual([{ userId: 'u1', order: 1, duration: 60, label: 'Ceremony' }]);
    });

    it('omits sets relation when no sets are provided', async () => {
      prisma.booking.create.mockResolvedValue({ id: 'b1' });
      await repo.create('u1', { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1' });
      const data = prisma.booking.create.mock.calls[0][0].data;
      expect(data.sets).toBeUndefined();
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
