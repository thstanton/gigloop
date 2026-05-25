import { InvoicesRepository } from './invoices.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  booking: { findFirst: jest.Mock };
  invoice: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  invoiceLineItem: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function makePrisma(): MockPrisma {
  return {
    booking: { findFirst: jest.fn() },
    invoice: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    invoiceLineItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('InvoicesRepository', () => {
  let repo: InvoicesRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new InvoicesRepository(prisma as unknown as PrismaService);
  });

  describe('findBookingCustomerId', () => {
    it('returns customerId when booking exists', async () => {
      prisma.booking.findFirst.mockResolvedValue({ customerId: 'c1' });
      const result = await repo.findBookingCustomerId('u1', 'b1');
      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: { id: 'b1', userId: 'u1' },
        select: { customerId: true },
      });
      expect(result).toBe('c1');
    });

    it('returns null when booking is not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      const result = await repo.findBookingCustomerId('u1', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('queries by userId and bookingId ordered by issueDate', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      await repo.findAll('u1', 'b1');
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', bookingId: 'b1' },
          orderBy: { issueDate: { sort: 'asc', nulls: 'last' } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('queries by id, userId, and bookingId', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 'b1', 'i1');
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'i1', userId: 'u1', bookingId: 'b1' } }),
      );
    });
  });

  describe('create', () => {
    it('creates invoice with resolved billToContactId and no line items', async () => {
      const invoice = { id: 'i1' };
      prisma.invoice.create.mockResolvedValue(invoice);
      await repo.create('u1', 'b1', 'c1', {});
      const data = prisma.invoice.create.mock.calls[0][0].data;
      expect(data.userId).toBe('u1');
      expect(data.bookingId).toBe('b1');
      expect(data.billToContactId).toBe('c1');
      expect(data.lineItems).toBeUndefined();
    });

    it('creates nested line items when provided, assigning order by index if not set', async () => {
      prisma.invoice.create.mockResolvedValue({ id: 'i1' });
      const lineItems = [
        { description: 'Fee', amount: 1000 },
        { description: 'Travel', amount: 50 },
      ];
      await repo.create('u1', 'b1', 'c1', { lineItems });
      const created = prisma.invoice.create.mock.calls[0][0].data.lineItems.create;
      expect(created[0]).toMatchObject({ userId: 'u1', description: 'Fee', amount: 1000, order: 0 });
      expect(created[1]).toMatchObject({ userId: 'u1', description: 'Travel', amount: 50, order: 1 });
    });

    it('respects an explicit order on line items', async () => {
      prisma.invoice.create.mockResolvedValue({ id: 'i1' });
      await repo.create('u1', 'b1', 'c1', {
        lineItems: [{ description: 'Fee', amount: 1000, order: 5 }],
      });
      const created = prisma.invoice.create.mock.calls[0][0].data.lineItems.create;
      expect(created[0].order).toBe(5);
    });

    it('strips billToContactId from the dto to avoid conflict with the resolved value', async () => {
      prisma.invoice.create.mockResolvedValue({ id: 'i1' });
      await repo.create('u1', 'b1', 'c1', { billToContactId: 'other' });
      const data = prisma.invoice.create.mock.calls[0][0].data;
      // The resolved billToContactId ('c1') is used, not the one from the dto
      expect(data.billToContactId).toBe('c1');
    });
  });

  describe('update', () => {
    it('updates invoice by id', async () => {
      const updated = { id: 'i1', status: 'SENT' };
      prisma.invoice.update.mockResolvedValue(updated);
      const result = await repo.update('i1', { status: 'SENT' as const });
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'i1' }, data: { status: 'SENT' } }),
      );
      expect(result).toBe(updated);
    });
  });

  describe('delete', () => {
    it('deletes invoice by id', async () => {
      prisma.invoice.delete.mockResolvedValue({ id: 'i1' });
      await repo.delete('i1');
      expect(prisma.invoice.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
    });
  });

  describe('findLineItem', () => {
    it('queries by itemId, invoiceId, and userId', async () => {
      prisma.invoiceLineItem.findFirst.mockResolvedValue(null);
      await repo.findLineItem('u1', 'i1', 'li1');
      expect(prisma.invoiceLineItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'li1', invoiceId: 'i1', userId: 'u1' },
      });
    });
  });

  describe('addLineItem', () => {
    it('creates line item with userId and invoiceId', async () => {
      const item = { id: 'li1' };
      prisma.invoiceLineItem.create.mockResolvedValue(item);
      const result = await repo.addLineItem('u1', 'i1', { description: 'Fee', amount: 500 });
      expect(prisma.invoiceLineItem.create).toHaveBeenCalledWith({
        data: { userId: 'u1', invoiceId: 'i1', description: 'Fee', amount: 500 },
      });
      expect(result).toBe(item);
    });
  });

  describe('updateLineItem', () => {
    it('updates line item by id', async () => {
      const updated = { id: 'li1', amount: 600 };
      prisma.invoiceLineItem.update.mockResolvedValue(updated);
      const result = await repo.updateLineItem('li1', { amount: 600 });
      expect(prisma.invoiceLineItem.update).toHaveBeenCalledWith({
        where: { id: 'li1' },
        data: { amount: 600 },
      });
      expect(result).toBe(updated);
    });
  });

  describe('deleteLineItem', () => {
    it('deletes line item by id', async () => {
      prisma.invoiceLineItem.delete.mockResolvedValue({ id: 'li1' });
      await repo.deleteLineItem('li1');
      expect(prisma.invoiceLineItem.delete).toHaveBeenCalledWith({ where: { id: 'li1' } });
    });
  });
});
