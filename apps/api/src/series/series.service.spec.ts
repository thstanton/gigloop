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
  markSeriesInvoicePaid: jest.Mock;
  findNonDraftNonVoidSeriesInvoice: jest.Mock;
  findDraftSeriesInvoiceWithLines: jest.Mock;
  appendSeriesInvoiceLine: jest.Mock;
  removeSeriesInvoiceLine: jest.Mock;
};

type MockInvoicesRepo = {
  delete: jest.Mock;
  previewSeriesInvoiceNumber: jest.Mock;
  getUserPaymentTerms: jest.Mock;
  assignSeriesAndMarkIssued: jest.Mock;
};

type MockLifecycle = {
  issueInvoice: jest.Mock;
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
    markSeriesInvoicePaid: jest.fn(),
    findNonDraftNonVoidSeriesInvoice: jest.fn().mockResolvedValue(null),
    findDraftSeriesInvoiceWithLines: jest.fn().mockResolvedValue(null),
    appendSeriesInvoiceLine: jest.fn(),
    removeSeriesInvoiceLine: jest.fn(),
  };
}

function makeInvoicesRepo(): MockInvoicesRepo {
  return {
    delete: jest.fn(),
    previewSeriesInvoiceNumber: jest.fn(),
    getUserPaymentTerms: jest.fn().mockResolvedValue(14),
    assignSeriesAndMarkIssued: jest.fn(),
  };
}

function makeLifecycle(): MockLifecycle {
  return {
    issueInvoice: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
    markSent: jest.fn().mockResolvedValue({ status: 'SENT' }),
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

const draftInvoice = { id: 'inv1', status: 'DRAFT', invoiceNumber: null, bookingId: null, lineItems: [] };
const issuedInvoice = { id: 'inv1', status: 'ISSUED', invoiceNumber: 'INV-2026-001', bookingId: null, lineItems: [] };
const sentInvoice = { id: 'inv1', status: 'SENT', invoiceNumber: 'INV-2026-001', bookingId: null, lineItems: [] };

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

    it('creates invoice with line items (including sourceBookingId) for each member booking', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      repo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking]);
      repo.createSeriesInvoice.mockResolvedValue({ id: 'inv1' });

      await service.createInvoice('u1', 's1');
      expect(repo.createSeriesInvoice).toHaveBeenCalledWith('u1', 's1', 'c1', expect.arrayContaining([
        expect.objectContaining({ amount: 500, order: 0, sourceBookingId: 'b1' }),
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

  describe('issueInvoice', () => {
    it('delegates to lifecycle.issueInvoice with assignSeriesAndMarkIssued callback', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      repo.findSeriesInvoiceById.mockResolvedValueOnce(draftInvoice).mockResolvedValueOnce(issuedInvoice);
      invoicesRepo.getUserPaymentTerms.mockResolvedValue(14);

      await service.issueInvoice('u1', 's1', 'inv1', { issueDate: '2026-06-01' });
      expect(lifecycle.issueInvoice).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ id: 'inv1', bookingId: null }),
        expect.objectContaining({ issueDate: expect.any(Date) }),
        expect.any(Function),
      );
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.issueInvoice('u1', 's1', 'inv1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('voidInvoice', () => {
    it('delegates to lifecycle.voidInvoice for a sent invoice', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      await service.voidInvoice('u1', 's1', 'inv1');
      expect(lifecycle.voidInvoice).toHaveBeenCalledWith(sentInvoice);
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.voidInvoice('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteInvoice', () => {
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
    const dto = {
      to: 'client@example.com', contactId: 'c1',
      subject: 'Invoice', body: '<p>Hi</p>',
    };

    it('delegates to lifecycle.send', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(issuedInvoice);
      await service.sendInvoice('u1', 's1', 'inv1', dto);
      expect(lifecycle.send).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ id: 'inv1', bookingId: null }),
        dto,
      );
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.sendInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markSentInvoice', () => {
    const dto = { issueDate: '2026-06-01', dueDate: '2026-06-15' };

    it('delegates to lifecycle.markSent', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(issuedInvoice);
      await service.markSentInvoice('u1', 's1', 'inv1', dto);
      expect(lifecycle.markSent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'inv1' }),
        dto,
      );
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.markSentInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markPaidInvoice', () => {
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

  // ─── membership guard + sync ───────────────────────────────────────────────

  describe('assertMembershipMutable', () => {
    it('resolves when no non-draft/non-void invoice exists', async () => {
      repo.findNonDraftNonVoidSeriesInvoice.mockResolvedValue(null);
      await expect(service.assertMembershipMutable('u1', 's1')).resolves.toBeUndefined();
    });

    it('throws ConflictException when an ISSUED invoice exists', async () => {
      repo.findNonDraftNonVoidSeriesInvoice.mockResolvedValue({ id: 'inv1', status: 'ISSUED' });
      await expect(service.assertMembershipMutable('u1', 's1')).rejects.toThrow(ConflictException);
    });
  });

  describe('syncMemberJoin', () => {
    const booking = { id: 'b1', date: new Date('2026-05-01'), fee: 500, sets: [] };

    it('is a no-op when no draft invoice exists', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue(null);
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.appendSeriesInvoiceLine).not.toHaveBeenCalled();
    });

    it('appends a traced line when a draft invoice exists and booking has no line', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [],
      });
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.appendSeriesInvoiceLine).toHaveBeenCalledWith(
        'u1', 'inv1',
        expect.objectContaining({ sourceBookingId: 'b1', amount: 500 }),
        undefined, // no tx threaded when called outside the atomic-create path
      );
    });

    it('is a no-op when the booking already has a traced line', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li1', sourceBookingId: 'b1', order: 0 }],
      });
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.appendSeriesInvoiceLine).not.toHaveBeenCalled();
    });
  });

  describe('syncMemberLeave', () => {
    it('is a no-op when no draft invoice exists', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue(null);
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
    });

    it('removes the traced line for the departing booking', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [
          { id: 'li1', sourceBookingId: 'b1', order: 0 },
          { id: 'li2', sourceBookingId: null, order: 1 },
        ],
      });
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).toHaveBeenCalledWith('li1');
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalledWith('li2');
    });

    it('is a no-op when the booking has no traced line', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li1', sourceBookingId: 'b2', order: 0 }],
      });
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
    });

    it('never removes custom lines (null sourceBookingId)', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li-custom', sourceBookingId: null, order: 0 }],
      });
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
    });
  });
});
