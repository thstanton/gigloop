import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SeriesService } from './series.service';
import { SeriesRepository } from './series.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { DocumentsService } from '../documents/documents.service';
import { CommunicationsService } from '../communications/communications.service';

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

type MockInvoicesRepo = { voidInvoice: jest.Mock; delete: jest.Mock; assignNewSequenceNumber: jest.Mock; assignWithInheritedNumber: jest.Mock };
type MockDocuments = { generatePreviewPdf: jest.Mock };
type MockComms = { sendEmail: jest.Mock };

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
  return { voidInvoice: jest.fn(), delete: jest.fn(), assignNewSequenceNumber: jest.fn(), assignWithInheritedNumber: jest.fn() };
}

function makeDocuments(): MockDocuments {
  return { generatePreviewPdf: jest.fn() };
}

function makeComms(): MockComms {
  return { sendEmail: jest.fn() };
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
  let documents: MockDocuments;
  let comms: MockComms;

  beforeEach(() => {
    repo = makeRepo();
    invoicesRepo = makeInvoicesRepo();
    documents = makeDocuments();
    comms = makeComms();
    service = new SeriesService(
      repo as unknown as SeriesRepository,
      invoicesRepo as unknown as InvoicesRepository,
      documents as unknown as DocumentsService,
      comms as unknown as CommunicationsService,
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
    const draftInvoice = { id: 'inv1', status: 'DRAFT' };
    const sentInvoice = { id: 'inv1', status: 'SENT' };

    it('voids a sent invoice', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      invoicesRepo.voidInvoice.mockResolvedValue({ ...sentInvoice, status: 'VOID' });
      await service.voidInvoice('u1', 's1', 'inv1');
      expect(invoicesRepo.voidInvoice).toHaveBeenCalledWith('inv1');
    });

    it('throws BadRequestException when voiding a DRAFT invoice', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      await expect(service.voidInvoice('u1', 's1', 'inv1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.voidInvoice('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
    });
  });
});
