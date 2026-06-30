import { ContactsRepository } from './contacts.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  contact: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  booking: {
    count: jest.Mock;
  };
};

function makePrisma(): MockPrisma {
  return {
    contact: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    booking: {
      count: jest.fn(),
    },
  };
}

describe('ContactsRepository', () => {
  let repo: ContactsRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new ContactsRepository(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('queries by userId and orders by name asc', async () => {
      prisma.contact.findMany.mockResolvedValue([]);
      await repo.findAll('u1');
      expect(prisma.contact.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { name: 'asc' },
      });
    });

    it('returns the list from Prisma', async () => {
      const contacts = [{ id: 'c1', name: 'Alice' }];
      prisma.contact.findMany.mockResolvedValue(contacts);
      const result = await repo.findAll('u1');
      expect(result).toBe(contacts);
    });
  });

  describe('findOne', () => {
    it('queries by id and userId', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 'c1');
      expect(prisma.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1', userId: 'u1' } }),
      );
    });

    it('includes all three booking relations as capped BookingRef selects', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 'c1');
      const call = prisma.contact.findFirst.mock.calls[0][0];
      // Each relation selects only the BookingRef fields (no full Booking over-fetch) and is
      // capped date-desc, rather than dragging the entire booking history in (#592).
      const expected = {
        select: { id: true, title: true, date: true, status: true, eventType: true },
        orderBy: { date: 'desc' },
        take: 200,
      };
      expect(call.include).toEqual({
        customerBookings: expected,
        venueBookings: expected,
        bookingAgentBookings: expected,
      });
    });

    it('returns null when not found', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);
      const result = await repo.findOne('u1', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('passes userId and data to Prisma', async () => {
      const contact = { id: 'c1', name: 'Bob' };
      prisma.contact.create.mockResolvedValue(contact);
      const result = await repo.create('u1', { name: 'Bob', email: 'bob@example.com' });
      expect(prisma.contact.create).toHaveBeenCalledWith({
        data: { userId: 'u1', name: 'Bob', email: 'bob@example.com' },
      });
      expect(result).toBe(contact);
    });
  });

  describe('update', () => {
    it('passes id and data to Prisma', async () => {
      const updated = { id: 'c1', name: 'Bobby' };
      prisma.contact.update.mockResolvedValue(updated);
      const result = await repo.update('c1', { name: 'Bobby' });
      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { name: 'Bobby' },
      });
      expect(result).toBe(updated);
    });
  });

  describe('countBookings', () => {
    it('counts bookings for all three FK roles', async () => {
      prisma.booking.count.mockResolvedValue(2);
      const count = await repo.countBookings('u1', 'c1');
      expect(prisma.booking.count).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          OR: [
            { customerId: 'c1' },
            { venueId: 'c1' },
            { bookingAgentId: 'c1' },
          ],
        },
      });
      expect(count).toBe(2);
    });

    it('returns 0 when contact has no bookings', async () => {
      prisma.booking.count.mockResolvedValue(0);
      expect(await repo.countBookings('u1', 'c1')).toBe(0);
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      const deleted = { id: 'c1' };
      prisma.contact.delete.mockResolvedValue(deleted);
      const result = await repo.delete('c1');
      expect(prisma.contact.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(result).toBe(deleted);
    });
  });
});
