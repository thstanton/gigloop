import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SeriesService } from './series.service';
import { SeriesRepository } from './series.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import type { DocumentsService } from '../documents/documents.service';
import type { CommunicationsService } from '../communications/communications.service';

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
};

type MockInvoicesRepo = {
  delete: jest.Mock;
  assignNewSequenceNumber: jest.Mock;
  assignWithInheritedNumber: jest.Mock;
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
  };
}

function makeInvoicesRepo(): MockInvoicesRepo {
  return {
    delete: jest.fn(),
    assignNewSequenceNumber: jest.fn(),
    assignWithInheritedNumber: jest.fn(),
    voidInvoice: jest.fn(),
  };
}

const mockDocuments = {
  generatePreviewPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-test')),
} as unknown as DocumentsService;

const mockComms = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
} as unknown as CommunicationsService;

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

  beforeEach(() => {
    repo = makeRepo();
    invoicesRepo = makeInvoicesRepo();
    (mockDocuments as unknown as { generatePreviewPdf: jest.Mock }).generatePreviewPdf.mockResolvedValue(Buffer.from('%PDF-test'));
    (mockComms as unknown as { sendEmail: jest.Mock }).sendEmail.mockResolvedValue(undefined);
    service = new SeriesService(
      repo as unknown as SeriesRepository,
      invoicesRepo as unknown as InvoicesRepository,
      mockDocuments,
      mockComms,
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

    it('calls invoicesRepo.voidInvoice for a sent invoice', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      invoicesRepo.voidInvoice.mockResolvedValue({ ...sentInvoice, status: 'VOID' });
      await service.voidInvoice('u1', 's1', 'inv1');
      expect(invoicesRepo.voidInvoice).toHaveBeenCalledWith('inv1');
    });

    it('throws BadRequestException when voiding a DRAFT invoice', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      await expect(service.voidInvoice('u1', 's1', 'inv1')).rejects.toThrow(BadRequestException);
      expect(invoicesRepo.voidInvoice).not.toHaveBeenCalled();
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
    const draftInvoice = { id: 'inv1', status: 'DRAFT', invoiceNumber: null };
    const numberedInvoice = { id: 'inv1', status: 'DRAFT', invoiceNumber: 'INV-2026-001' };
    const dto = {
      issueDate: '2026-06-01', dueDate: '2026-06-15',
      to: 'client@example.com', contactId: 'c1',
      subject: 'Invoice', body: '<p>Hi</p>',
    };

    beforeEach(() => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      repo.findVoidedSeriesInvoiceWithNumber.mockResolvedValue(null);
      invoicesRepo.assignNewSequenceNumber.mockResolvedValue(numberedInvoice);
    });

    it('calls generatePreviewPdf and sendEmail', async () => {
      await service.sendInvoice('u1', 's1', 'inv1', dto);
      expect((mockDocuments as unknown as { generatePreviewPdf: jest.Mock }).generatePreviewPdf)
        .toHaveBeenCalledWith('u1', 'inv1');
      expect((mockComms as unknown as { sendEmail: jest.Mock }).sendEmail)
        .toHaveBeenCalledWith(expect.objectContaining({ to: dto.to, subject: dto.subject }));
    });

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue({ ...draftInvoice, status: 'SENT' });
      await expect(service.sendInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.sendInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markSentInvoice', () => {
    const draftInvoice = { id: 'inv1', status: 'DRAFT', invoiceNumber: null };
    const dto = { issueDate: '2026-06-01', dueDate: '2026-06-15' };

    beforeEach(() => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      repo.findVoidedSeriesInvoiceWithNumber.mockResolvedValue(null);
      invoicesRepo.assignNewSequenceNumber.mockResolvedValue({ id: 'inv1', invoiceNumber: 'INV-2026-001' });
    });

    it('assigns a number and marks as sent', async () => {
      await service.markSentInvoice('u1', 's1', 'inv1', dto);
      expect(invoicesRepo.assignNewSequenceNumber).toHaveBeenCalledWith(
        'u1', 'inv1', new Date(dto.issueDate), new Date(dto.dueDate),
      );
    });

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue({ ...draftInvoice, status: 'SENT' });
      await expect(service.markSentInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when issueDate is not provided', async () => {
      await expect(service.markSentInvoice('u1', 's1', 'inv1', {})).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.markSentInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markPaidInvoice', () => {
    const sentInvoice = { id: 'inv1', status: 'SENT', invoiceNumber: 'INV-2026-001' };

    it('calls repo.markSeriesInvoicePaid', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      repo.markSeriesInvoicePaid.mockResolvedValue({ ...sentInvoice, status: 'PAID' });
      await service.markPaidInvoice('u1', 's1', 'inv1');
      expect(repo.markSeriesInvoicePaid).toHaveBeenCalledWith('inv1');
    });

    it('throws BadRequestException when invoice is not SENT', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue({ id: 'inv1', status: 'DRAFT', invoiceNumber: null });
      await expect(service.markPaidInvoice('u1', 's1', 'inv1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.markPaidInvoice('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
    });
  });
});
