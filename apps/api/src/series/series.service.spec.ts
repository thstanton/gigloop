import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SeriesService } from './series.service';
import { SeriesRepository } from './series.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { InvoiceTransitionService } from '../invoices/invoice-transition.service';
import { DocumentsService } from '../documents/documents.service';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  findOneMinimal: jest.Mock;
  create: jest.Mock;
  findMemberBookingsForInvoice: jest.Mock;
  findDraftSeriesInvoiceWithLines: jest.Mock;
  appendSeriesInvoiceLine: jest.Mock;
  removeSeriesInvoiceLine: jest.Mock;
};

// Invoice lifecycle CRUD lives in InvoicesRepository for both owners (ADR-0063), so series
// invoice reads/writes are mocked here rather than on the SeriesRepository mock.
type MockInvoicesRepo = {
  delete: jest.Mock;
  previewSeriesInvoiceNumber: jest.Mock;
  findSeriesInvoiceById: jest.Mock;
  findActiveSeriesInvoice: jest.Mock;
  createSeriesInvoice: jest.Mock;
  countNonVoidSeriesInvoices: jest.Mock;
  findNonDraftNonVoidSeriesInvoice: jest.Mock;
};

type MockTransition = {
  issueInvoice: jest.Mock;
  send: jest.Mock;
  markSent: jest.Mock;
  markPaid: jest.Mock;
  correctPayment: jest.Mock;
  voidInvoice: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOneMinimal: jest.fn(),
    create: jest.fn(),
    findMemberBookingsForInvoice: jest.fn(),
    findDraftSeriesInvoiceWithLines: jest.fn().mockResolvedValue(null),
    appendSeriesInvoiceLine: jest.fn(),
    removeSeriesInvoiceLine: jest.fn(),
  };
}

function makeInvoicesRepo(): MockInvoicesRepo {
  return {
    delete: jest.fn(),
    previewSeriesInvoiceNumber: jest.fn(),
    findSeriesInvoiceById: jest.fn(),
    findActiveSeriesInvoice: jest.fn(),
    createSeriesInvoice: jest.fn(),
    countNonVoidSeriesInvoices: jest.fn(),
    findNonDraftNonVoidSeriesInvoice: jest.fn().mockResolvedValue(null),
  };
}

type MockDocuments = {
  generatePreviewPdf: jest.Mock;
  findByInvoice: jest.Mock;
};

function makeDocuments(): MockDocuments {
  return {
    generatePreviewPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
    findByInvoice: jest.fn().mockResolvedValue(null),
  };
}

function makeTransition(): MockTransition {
  return {
    issueInvoice: jest.fn().mockResolvedValue({ status: 'ISSUED' }),
    send: jest.fn().mockResolvedValue(undefined),
    markSent: jest.fn().mockResolvedValue({ status: 'SENT' }),
    markPaid: jest.fn().mockResolvedValue({ status: 'PAID' }),
    correctPayment: jest.fn().mockResolvedValue({ status: 'PAID' }),
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

const draftInvoice = { id: 'inv1', status: 'DRAFT', invoiceNumber: null, bookingId: null, seriesId: 's1', isDeposit: false, lineItems: [] };
const issuedInvoice = { id: 'inv1', status: 'ISSUED', invoiceNumber: 'INV-2026-001', bookingId: null, seriesId: 's1', isDeposit: false, lineItems: [] };
const sentInvoice = { id: 'inv1', status: 'SENT', invoiceNumber: 'INV-2026-001', bookingId: null, seriesId: 's1', isDeposit: false, lineItems: [] };

describe('SeriesService', () => {
  let service: SeriesService;
  let repo: MockRepo;
  let invoicesRepo: MockInvoicesRepo;
  let transition: MockTransition;
  let documents: MockDocuments;

  beforeEach(() => {
    repo = makeRepo();
    invoicesRepo = makeInvoicesRepo();
    transition = makeTransition();
    documents = makeDocuments();
    service = new SeriesService(
      repo as unknown as SeriesRepository,
      invoicesRepo as unknown as InvoicesRepository,
      transition as unknown as InvoiceTransitionService,
      documents as unknown as DocumentsService,
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
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking]);
      invoicesRepo.createSeriesInvoice.mockResolvedValue({ id: 'inv1' });

      await service.createInvoice('u1', 's1');
      expect(invoicesRepo.createSeriesInvoice).toHaveBeenCalledWith('u1', 's1', 'c1', expect.arrayContaining([
        expect.objectContaining({ amount: 500, order: 0, sourceBookingId: 'b1' }),
      ]));
    });

    it('returns the created invoice alongside a feeless-member count', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking]);
      invoicesRepo.createSeriesInvoice.mockResolvedValue({ id: 'inv1' });

      const result = await service.createInvoice('u1', 's1');
      expect(result).toEqual({ invoice: { id: 'inv1' }, feelessMemberCount: 0 });
    });

    // #850: a fee-less member still bills a £0.00 line (the date must appear on the invoice) —
    // the count surfaces to the musician so it never reaches a client unnoticed.
    it('counts fee-less members and still bills them a £0.00 line', async () => {
      const feeless = { id: 'b2', date: new Date('2026-05-08'), fee: null, sets: [] };
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([booking, feeless]);
      invoicesRepo.createSeriesInvoice.mockResolvedValue({ id: 'inv1' });

      const result = await service.createInvoice('u1', 's1');
      expect(result.feelessMemberCount).toBe(1);
      expect(invoicesRepo.createSeriesInvoice).toHaveBeenCalledWith('u1', 's1', 'c1', expect.arrayContaining([
        expect.objectContaining({ amount: 0, sourceBookingId: 'b2' }),
      ]));
    });

    it('throws ConflictException when non-VOID invoice exists', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(1);
      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(ConflictException);
      expect(invoicesRepo.createSeriesInvoice).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when series has no member bookings', async () => {
      repo.findOneMinimal.mockResolvedValue(series);
      invoicesRepo.countNonVoidSeriesInvoices.mockResolvedValue(0);
      repo.findMemberBookingsForInvoice.mockResolvedValue([]);
      await expect(service.createInvoice('u1', 's1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('issueInvoice', () => {
    it('delegates to transition.issueInvoice with the loaded invoice and dto', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      const dto = { issueDate: '2026-06-01' };

      await service.issueInvoice('u1', 's1', 'inv1', dto);
      expect(transition.issueInvoice).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ id: 'inv1', seriesId: 's1', bookingId: null }),
        dto,
      );
    });

    it('throws NotFoundException when invoice not found', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.issueInvoice('u1', 's1', 'inv1', {})).rejects.toThrow(NotFoundException);
      expect(transition.issueInvoice).not.toHaveBeenCalled();
    });
  });

  describe('voidInvoice', () => {
    it('delegates to transition.voidInvoice for a sent invoice', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      await service.voidInvoice('u1', 's1', 'inv1');
      expect(transition.voidInvoice).toHaveBeenCalledWith(sentInvoice);
    });

    it('throws NotFoundException when invoice not found', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.voidInvoice('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteInvoice', () => {
    it('deletes a DRAFT invoice', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      invoicesRepo.delete.mockResolvedValue({});
      await service.deleteInvoice('u1', 's1', 'inv1');
      expect(invoicesRepo.delete).toHaveBeenCalledWith('inv1');
    });

    it('throws BadRequestException for non-DRAFT invoice', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      await expect(service.deleteInvoice('u1', 's1', 'inv1')).rejects.toThrow(BadRequestException);
      expect(invoicesRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when invoice not found', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.deleteInvoice('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendInvoice', () => {
    const dto = {
      to: 'client@example.com', contactId: 'c1',
      subject: 'Invoice', body: '<p>Hi</p>',
    };

    it('delegates to transition.send', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(issuedInvoice);
      await service.sendInvoice('u1', 's1', 'inv1', dto);
      expect(transition.send).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ id: 'inv1', bookingId: null }),
        dto,
      );
    });

    it('throws NotFoundException when invoice not found', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.sendInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markSentInvoice', () => {
    const dto = { issueDate: '2026-06-01', dueDate: '2026-06-15' };

    it('delegates to transition.markSent', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(issuedInvoice);
      await service.markSentInvoice('u1', 's1', 'inv1', dto);
      expect(transition.markSent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'inv1' }),
        dto,
      );
    });

    it('throws NotFoundException when invoice not found', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.markSentInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markPaidInvoice', () => {
    const dto = { paidAt: '2026-08-18', paymentReference: 'BACS-4417' };

    it('delegates to transition.markPaid with the dto', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      await service.markPaidInvoice('u1', 's1', 'inv1', dto);
      expect(transition.markPaid).toHaveBeenCalledWith(sentInvoice, dto);
    });

    it('throws NotFoundException when invoice not found', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.markPaidInvoice('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('correctInvoicePayment', () => {
    const dto = { paidAt: '2026-08-02', paymentReference: 'BACS-9' };

    it('delegates to transition.correctPayment with the dto', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(sentInvoice);
      await service.correctInvoicePayment('u1', 's1', 'inv1', dto);
      expect(transition.correctPayment).toHaveBeenCalledWith(sentInvoice, dto);
    });

    it('throws NotFoundException when invoice not found', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.correctInvoicePayment('u1', 's1', 'inv1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── invoice PDF access (#830) ─────────────────────────────────────────────
  //
  // A series invoice's PDF is generated and stored at issue exactly like a booking invoice's, but
  // its Document carries `bookingId: null`, so it appears in no booking's document list. These two
  // reads are the musician's only route to the artifact — without them it is generated, stored and
  // emailed to the client while staying invisible to its owner.

  describe('generateInvoicePreviewPdf', () => {
    it('renders a DRAFT with the provisional number it would get on issue', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      invoicesRepo.previewSeriesInvoiceNumber.mockResolvedValue({ invoiceNumber: 'INV-2026-007' });

      const buffer = await service.generateInvoicePreviewPdf('u1', 's1', 'inv1');

      expect(documents.generatePreviewPdf).toHaveBeenCalledWith('u1', 'inv1', 'INV-2026-007');
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('passes no preview number once the invoice has a real one', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(issuedInvoice);

      await service.generateInvoicePreviewPdf('u1', 's1', 'inv1');

      expect(invoicesRepo.previewSeriesInvoiceNumber).not.toHaveBeenCalled();
      expect(documents.generatePreviewPdf).toHaveBeenCalledWith('u1', 'inv1', undefined);
    });

    it('throws NotFoundException when the invoice is not in this series', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.generateInvoicePreviewPdf('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
      expect(documents.generatePreviewPdf).not.toHaveBeenCalled();
    });
  });

  describe('getInvoiceDocument', () => {
    it('returns the stored PDF for an issued invoice', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(issuedInvoice);
      const stored = { id: 'doc1', createdAt: new Date(), url: '/documents/doc1/download' };
      documents.findByInvoice.mockResolvedValue(stored);

      const result = await service.getInvoiceDocument('u1', 's1', 'inv1');

      // Looked up by invoice id alone — a series document has no bookingId to scope by.
      expect(documents.findByInvoice).toHaveBeenCalledWith('u1', 'inv1');
      expect(result).toBe(stored);
    });

    it('returns null for a DRAFT — no PDF exists until issue', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(draftInvoice);
      documents.findByInvoice.mockResolvedValue(null);

      await expect(service.getInvoiceDocument('u1', 's1', 'inv1')).resolves.toBeNull();
    });

    it('throws NotFoundException when the invoice is not in this series', async () => {
      invoicesRepo.findSeriesInvoiceById.mockResolvedValue(null);
      await expect(service.getInvoiceDocument('u1', 's1', 'inv1')).rejects.toThrow(NotFoundException);
      expect(documents.findByInvoice).not.toHaveBeenCalled();
    });
  });

  // ─── membership guard + sync ───────────────────────────────────────────────

  describe('assertMembershipMutable', () => {
    it('resolves when no non-draft/non-void invoice exists', async () => {
      invoicesRepo.findNonDraftNonVoidSeriesInvoice.mockResolvedValue(null);
      await expect(service.assertMembershipMutable('u1', 's1')).resolves.toBeUndefined();
    });

    it('throws ConflictException when an ISSUED invoice exists', async () => {
      invoicesRepo.findNonDraftNonVoidSeriesInvoice.mockResolvedValue({ id: 'inv1', status: 'ISSUED' });
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

  // ADR-0043's guarantee, finally exercised (#845). Its whole rationale is that reconciliation
  // preserves manual edits and custom lines — but until the owner-agnostic write routes existed
  // no route could produce either, so the reconciler's `sourceBookingId !== null` guard had been
  // protecting an empty set. These assert the guarantee against line states that are now reachable.
  describe('reconciliation preserves hand-made changes (ADR-0043)', () => {
    const booking = { id: 'b1', date: new Date('2026-05-01'), fee: 500, sets: [] };

    it('leaves a manually edited amount on a traced line untouched', async () => {
      // The line traces to b1 but its amount was edited by hand to 750, against a 500 fee.
      // Reconciliation must not rewrite it back.
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li1', sourceBookingId: 'b1', order: 0, amount: 750 }],
      });
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.appendSeriesInvoiceLine).not.toHaveBeenCalled();
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
    });

    it('leaves a hand-added custom line untouched when a new member joins', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [{ id: 'li-custom', sourceBookingId: null, order: 0, amount: 200 }],
      });
      await service.syncMemberJoin('u1', 's1', booking);
      expect(repo.removeSeriesInvoiceLine).not.toHaveBeenCalled();
      // The joining member still gets its own traced line — a custom line neither blocks the
      // append nor is mistaken for one.
      expect(repo.appendSeriesInvoiceLine).toHaveBeenCalledWith(
        'u1', 'inv1',
        expect.objectContaining({ sourceBookingId: 'b1' }),
        undefined,
      );
    });

    it('keeps custom lines and edited traced lines across a departure', async () => {
      repo.findDraftSeriesInvoiceWithLines.mockResolvedValue({
        id: 'inv1',
        lineItems: [
          { id: 'li1', sourceBookingId: 'b1', order: 0, amount: 500 },
          { id: 'li2', sourceBookingId: 'b2', order: 1, amount: 900 },
          { id: 'li-custom', sourceBookingId: null, order: 2, amount: 200 },
        ],
      });
      await service.syncMemberLeave('u1', 's1', 'b1');
      expect(repo.removeSeriesInvoiceLine).toHaveBeenCalledTimes(1);
      expect(repo.removeSeriesInvoiceLine).toHaveBeenCalledWith('li1');
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
