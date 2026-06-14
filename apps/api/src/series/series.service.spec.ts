import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SeriesService } from './series.service';
import { SeriesRepository } from './series.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { InvoiceLifecycleService } from '../invoices/invoice-lifecycle.service';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  findOneMinimal: jest.Mock;
  create: jest.Mock;
  countNonVoidSeriesInvoices: jest.Mock;
  findMemberBookingsForInvoice: jest.Mock;
  findSeriesInvoiceById: jest.Mock;
  findVoidedSeriesInvoiceWithNumber: jest.Mock;
  findActiveSeriesInvoice: jest.Mock;
  createSeriesInvoice: jest.Mock;
};

type MockInvoicesRepo = {
  delete: jest.Mock;
  assignNewSequenceNumber: jest.Mock;
  assignWithInheritedNumber: jest.Mock;
  assignSeriesInvoiceNumberOnly: jest.Mock;
};

type MockLifecycle = {
  send: jest.Mock;
  markSent: jest.Mock;
  markPaid: jest.Mock;
  voidInvoice: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOneMinimal: jest.fn(),
    create: jest.fn(),
    countNonVoidSeriesInvoices: jest.fn(),
    findMemberBookingsForInvoice: jest.fn(),
    findSeriesInvoiceById: jest.fn(),
    findVoidedSeriesInvoiceWithNumber: jest.fn(),
    findActiveSeriesInvoice: jest.fn(),
    createSeriesInvoice: jest.fn(),
  };
}

function makeInvoicesRepo(): MockInvoicesRepo {
  return {
    delete: jest.fn(),
    assignNewSequenceNumber: jest.fn(),
    assignWithInheritedNumber: jest.fn(),
    assignSeriesInvoiceNumberOnly: jest.fn(),
  };
}

function makeLifecycle(): MockLifecycle {
  return {
    send: jest.fn().mockResolvedValue(undefined),
    markSent: jest.fn().mockResolvedValue({ status: 'SENT', invoiceNumber: 'INV-2026-001' }),
    markPaid: jest.fn().mockResolvedValue({ status: 'PAID' }),
    voidInvoice: jest.fn().mockResolvedValue({ status: 'VOID' }),
  };
}

const seriesWithMeta = {
  id: 's1', createdAt: new Date(), updatedAt: new Date(),
  label: 'Hotel X — May 2026', customerId: 'c1',
  customer: { id: 'c1', name: 'Hotel X', email: null },
  bookings: [{ id: 'b1' }, { id: 'b2' }],
  invoices: [{ id: 'inv1', status: 'SENT' }],
};

const series = {
  id: 's1', customerId: 'c1',
  customer: { id: 'c1', name: 'Hotel X', email: null },
};

describe('SeriesService', () => {
  let service: SeriesService;
  let repo: MockRepo;
  let invoicesRepo: MockInvoicesRepo;
  let lifecycle: MockLifecycle;

  beforeEach(() => {
    repo = makeRepo();
    invoicesRepo = makeInvoicesRepo();
    lifecycle = makeLifecycle();
    service = new SeriesService(
      repo as unknown as SeriesRepository,
      invoicesRepo as unknown as InvoicesRepository,
      lifecycle as unknown as InvoiceLifecycleService,
    );
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([{ id: 's1', label: 'Test' }]);
      const result = await service.findAll('u1');
      expect(repo.findAll).toHaveBeenCalledWith('u1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns series with derived fields', async () => {
      repo.findOne.mockResolvedValue(seriesWithMeta);
      const result = await service.findOne('u1', 's1');
      expect(result.memberBookingCount).toBe(2);
      expect(result.invoiceStatus).toBe('SENT');
    });

    it('returns null invoiceStatus when all invoices are VOID', async () => {
      repo.findOne.mockResolvedValue({
        ...seriesWithMeta,
        invoices: [{ id: 'inv1', status: 'VOID' }],
      });
      const result = await service.findOne('u1', 's1');
      expect(result.invoiceStatus).toBeNull();
    });

    it('returns null invoiceStatus when series has no invoices', async () => {
      repo.findOne.mockResolvedValue({ ...seriesWithMeta, invoices: [] });
      const result = await service.findOne('u1', 's1');
      expect(result.invoiceStatus).toBeNull();
    });

    it('throws NotFoundException when series not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createInvoice', () => {
    const booking = { id: 'b1', date: new Date('2026-05-01'), fee: 500, sets: [] };

    it('creates invoice with line items for each member booking', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      repo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking]);
      repo.createSeriesInvoice.mockResolvedValue({ id: 'inv1' });

      await service.createInvoice('u1', 's1');
      expect(repo.createSeriesInvoice).toHaveBeenCalledWith('u1', 's1', 'c1', expect.arrayContaining([
        expect.objectContaining({ amount: 500, order: 0 }),
      ]));
    });

    it('throws ConflictException when non-VOID invoice exists', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      repo.countNonVoidSeriesInvoices.mockResolvedValue(1);
      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(ConflictException);
      expect(repo.createSeriesInvoice).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when series has no member bookings', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      repo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([]);
      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('voidInvoice', () => {
    const sentInvoice = { id: 'inv1', status: 'SENT', invoiceNumber: 'INV-2026-001' };
    const draftInvoice = { id: 'inv1', status: 'DRAFT', invoiceNumber: null };

    it('delegates to lifecycle.voidInvoice for a sent invoice', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      await service.voidInvoice('u1', 's1', 'inv1');
      expect(lifecycle.voidInvoice).toHaveBeenCalledWith(sentInvoice);
    });

    it('throws BadRequestException when voiding a DRAFT invoice (via lifecycle)', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      lifecycle.voidInvoice.mockRejectedValue(new BadRequestException('Draft invoices cannot be voided'));
      await expect(service.voidInvoice('u1', 's1', 'inv1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.voidInvoice('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteInvoice', () => {
    const draftInvoice = { id: 'inv1', status: 'DRAFT', invoiceNumber: null };
    const sentInvoice = { id: 'inv1', status: 'SENT', invoiceNumber: 'INV-2026-001' };

    it('deletes a DRAFT invoice', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      invoicesRepo.delete.mockResolvedValue({});
      await service.deleteInvoice('u1', 's1', 'inv1');
      expect(invoicesRepo.delete).toHaveBeenCalledWith('inv1');
    });

    it('throws BadRequestException for non-DRAFT invoice', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      await expect(service.deleteInvoice('u1', 's1', 'inv1')).rejects.toThrow(BadRequestException);
      expect(invoicesRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.deleteInvoice('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendInvoice', () => {
    const draftInvoice = { id: 'inv1', status: 'DRAFT', invoiceNumber: null, bookingId: null, seriesId: 's1' };
    const dto = {
      issueDate: '2026-06-01', dueDate: '2026-06-15',
      to: 'client@example.com', contactId: 'c1',
      subject: 'Invoice', body: '<p>Hi</p>',
    };

    it('delegates to lifecycle.send', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      await service.sendInvoice('u1', 's1', 'inv1', dto);
      expect(lifecycle.send).toHaveBeenCalledWith('u1', draftInvoice, dto, expect.any(Function));
    });

    it('passes an assignNumberOnly callback that calls assignSeriesInvoiceNumberOnly', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      let capturedCallback: ((id: string, issueDate: Date, dueDate: Date | null) => Promise<unknown>) | undefined;
      lifecycle.send.mockImplementation(async (_userId, _invoice, _dto, cb) => {
        capturedCallback = cb;
      });

      await service.sendInvoice('u1', 's1', 'inv1', dto);

      const issueDate = new Date('2026-06-01');
      const dueDate = new Date('2026-06-15');
      await capturedCallback!('inv1', issueDate, dueDate);

      expect(invoicesRepo.assignSeriesInvoiceNumberOnly).toHaveBeenCalledWith('u1', {
        id: 'inv1', seriesId: 's1', issueDate, dueDate,
      });
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.sendInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markSentInvoice', () => {
    const draftInvoice = { id: 'inv1', status: 'DRAFT', invoiceNumber: null };
    const dto = { issueDate: '2026-06-01', dueDate: '2026-06-15' };

    it('delegates to lifecycle.markSent', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      await service.markSentInvoice('u1', 's1', 'inv1', dto);
      expect(lifecycle.markSent).toHaveBeenCalledWith(draftInvoice, dto, expect.any(Function));
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.markSentInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markPaidInvoice', () => {
    const sentInvoice = { id: 'inv1', status: 'SENT', invoiceNumber: 'INV-2026-001' };

    it('delegates to lifecycle.markPaid', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      await service.markPaidInvoice('u1', 's1', 'inv1');
      expect(lifecycle.markPaid).toHaveBeenCalledWith(sentInvoice);
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.markPaidInvoice('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
    });
  });
});
