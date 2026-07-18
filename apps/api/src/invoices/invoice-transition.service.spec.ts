import { BadRequestException } from '@nestjs/common';
import { InvoiceTransitionService } from './invoice-transition.service';
import { InvoicesRepository } from './invoices.repository';
import { DocumentsService } from '../documents/documents.service';
import { CommunicationsService } from '../communications/communications.service';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';
import { ChecklistRepository } from '../checklist/checklist.repository';

// ─── Fixtures ──────────────────────────────────────────────────────────────────
// Invoice is one polymorphic entity (ADR-0029): a booking invoice has bookingId set + seriesId
// null; a series invoice the reverse. Every field-derived side-effect keys off these.

const bookingDraft = { id: 'i1', status: 'DRAFT' as const, invoiceNumber: null, bookingId: 'b1', seriesId: null, isDeposit: false };
const bookingDepositDraft = { ...bookingDraft, isDeposit: true };
const bookingIssued = { ...bookingDraft, status: 'ISSUED' as const, invoiceNumber: 'INV-2026-001' };
const bookingSent = { ...bookingDraft, status: 'SENT' as const, invoiceNumber: 'INV-2026-001' };
const bookingDepositSent = { ...bookingSent, isDeposit: true };
const bookingPaid = { ...bookingSent, status: 'PAID' as const };
const bookingVoided = { ...bookingSent, status: 'VOID' as const };

const seriesDraft = { id: 'i2', status: 'DRAFT' as const, invoiceNumber: null, bookingId: null, seriesId: 's1', isDeposit: false };
const seriesIssued = { ...seriesDraft, status: 'ISSUED' as const, invoiceNumber: 'INV-2026-002' };
const seriesSent = { ...seriesDraft, status: 'SENT' as const, invoiceNumber: 'INV-2026-002' };

const pdfBuffer = Buffer.from('%PDF-test');
const numberedInvoice = {
  id: 'i1', invoiceNumber: 'INV-2026-001', issueDate: new Date(), dueDate: null,
  isDeposit: false, bookingId: 'b1',
  billToContact: { name: 'Test Client' },
  lineItems: [{ description: 'Fee', amount: 1000, order: 0 }],
};
const numberedSeriesInvoice = { ...numberedInvoice, id: 'i2', bookingId: null, invoiceNumber: 'INV-2026-002' };

const sendDto = {
  issueDate: '2026-06-01', dueDate: '2026-06-15',
  to: 'client@example.com', contactId: 'c1',
  subject: 'Invoice', body: '<p>Hi</p>',
};

describe('InvoiceTransitionService', () => {
  let service: InvoiceTransitionService;
  let mockRepo: {
    assignAndMarkIssued: jest.Mock;
    assignSeriesAndMarkIssued: jest.Mock;
    getUserPaymentTerms: jest.Mock;
    markSentById: jest.Mock;
    markPaidBase: jest.Mock;
    setBookingDepositReceivedAt: jest.Mock;
    voidInvoice: jest.Mock;
    countActiveByType: jest.Mock;
  };
  let mockDocuments: {
    generateAndStoreInvoicePdf: jest.Mock;
    getStoredInvoicePdfBuffer: jest.Mock;
  };
  let mockComms: { sendEmail: jest.Mock };
  let mockReeval: { onBookingChanged: jest.Mock };
  let mockChecklistRepo: { resetItemByKey: jest.Mock };

  beforeEach(() => {
    mockRepo = {
      assignAndMarkIssued: jest.fn().mockResolvedValue(numberedInvoice),
      assignSeriesAndMarkIssued: jest.fn().mockResolvedValue(numberedSeriesInvoice),
      getUserPaymentTerms: jest.fn().mockResolvedValue(14),
      markSentById: jest.fn().mockResolvedValue({ ...bookingSent }),
      markPaidBase: jest.fn().mockResolvedValue({ ...bookingPaid }),
      setBookingDepositReceivedAt: jest.fn().mockResolvedValue({}),
      voidInvoice: jest.fn().mockResolvedValue({ ...bookingVoided }),
      countActiveByType: jest.fn().mockResolvedValue(0),
    };
    mockDocuments = {
      generateAndStoreInvoicePdf: jest.fn().mockResolvedValue({ buffer: pdfBuffer, documentId: 'doc-generated' }),
      getStoredInvoicePdfBuffer: jest.fn().mockResolvedValue({ buffer: pdfBuffer, documentId: 'doc-stored' }),
    };
    mockComms = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    mockReeval = { onBookingChanged: jest.fn().mockResolvedValue(undefined) };
    mockChecklistRepo = { resetItemByKey: jest.fn().mockResolvedValue({ count: 0 }) };
    service = new InvoiceTransitionService(
      mockRepo as unknown as InvoicesRepository,
      mockDocuments as unknown as DocumentsService,
      mockComms as unknown as CommunicationsService,
      mockReeval as unknown as ChecklistReevaluator,
      mockChecklistRepo as unknown as ChecklistRepository,
    );
  });

  // ─── issueInvoice ──────────────────────────────────────────────────────────

  describe('issueInvoice', () => {
    it('throws BadRequestException when invoice is not DRAFT', async () => {
      await expect(service.issueInvoice('u1', bookingIssued, {})).rejects.toThrow(BadRequestException);
      expect(mockRepo.assignAndMarkIssued).not.toHaveBeenCalled();
    });

    it('allocates a booking number via assignAndMarkIssued with booking context', async () => {
      await service.issueInvoice('u1', bookingDepositDraft, { issueDate: '2026-06-01', dueDate: '2026-06-15' });
      expect(mockRepo.assignAndMarkIssued).toHaveBeenCalledWith('u1', {
        id: 'i1', bookingId: 'b1', isDeposit: true,
        issueDate: new Date('2026-06-01'), dueDate: new Date('2026-06-15'),
      });
      expect(mockRepo.assignSeriesAndMarkIssued).not.toHaveBeenCalled();
    });

    it('allocates a series number via assignSeriesAndMarkIssued for a series invoice', async () => {
      await service.issueInvoice('u1', seriesDraft, { issueDate: '2026-06-01', dueDate: '2026-06-15' });
      expect(mockRepo.assignSeriesAndMarkIssued).toHaveBeenCalledWith('u1', {
        id: 'i2', seriesId: 's1',
        issueDate: new Date('2026-06-01'), dueDate: new Date('2026-06-15'),
      });
      expect(mockRepo.assignAndMarkIssued).not.toHaveBeenCalled();
    });

    it('defaults issueDate to today when not provided', async () => {
      const before = new Date();
      before.setHours(0, 0, 0, 0);
      await service.issueInvoice('u1', bookingDraft, {});
      const [, { issueDate }] = mockRepo.assignAndMarkIssued.mock.calls[0];
      expect(issueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('computes dueDate from user payment terms when not provided', async () => {
      mockRepo.getUserPaymentTerms.mockResolvedValue(30);
      await service.issueInvoice('u1', bookingDraft, {});
      const [, { issueDate, dueDate }] = mockRepo.assignAndMarkIssued.mock.calls[0];
      const expected = new Date(issueDate);
      expected.setDate(expected.getDate() + 30);
      expect(dueDate?.toDateString()).toBe(expected.toDateString());
    });

    it('leaves dueDate null when payment terms are 0', async () => {
      mockRepo.getUserPaymentTerms.mockResolvedValue(0);
      await service.issueInvoice('u1', bookingDraft, {});
      const [, { dueDate }] = mockRepo.assignAndMarkIssued.mock.calls[0];
      expect(dueDate).toBeNull();
    });

    it('generates and stores the PDF with the bookingId after assigning the number', async () => {
      await service.issueInvoice('u1', bookingDraft, {});
      expect(mockDocuments.generateAndStoreInvoicePdf).toHaveBeenCalledWith('u1', 'i1', numberedInvoice, 'b1');
    });

    it('passes undefined bookingId to generateAndStoreInvoicePdf for series invoices', async () => {
      await service.issueInvoice('u1', seriesDraft, {});
      expect(mockDocuments.generateAndStoreInvoicePdf).toHaveBeenCalledWith('u1', 'i2', numberedSeriesInvoice, undefined);
    });

    it('re-evaluates the booking checklist for a booking invoice', async () => {
      await service.issueInvoice('u1', bookingDraft, {});
      expect(mockReeval.onBookingChanged).toHaveBeenCalledWith('b1');
    });

    it('does not re-evaluate any checklist for a series invoice', async () => {
      await service.issueInvoice('u1', seriesDraft, {});
      expect(mockReeval.onBookingChanged).not.toHaveBeenCalled();
    });

    it('does not generate a PDF when the number assignment fails', async () => {
      mockRepo.assignAndMarkIssued.mockRejectedValue(new Error('db error'));
      await expect(service.issueInvoice('u1', bookingDraft, {})).rejects.toThrow('db error');
      expect(mockDocuments.generateAndStoreInvoicePdf).not.toHaveBeenCalled();
    });

    it('returns the written invoice without re-fetching', async () => {
      const result = await service.issueInvoice('u1', bookingDraft, {});
      expect(result).toBe(numberedInvoice);
    });
  });

  // ─── send ──────────────────────────────────────────────────────────────────

  describe('send', () => {
    it('throws BadRequestException when invoice is not ISSUED', async () => {
      await expect(service.send('u1', bookingDraft, sendDto)).rejects.toThrow(BadRequestException);
    });

    it('retrieves the stored PDF and does not regenerate it', async () => {
      await service.send('u1', bookingIssued, sendDto);
      expect(mockDocuments.getStoredInvoicePdfBuffer).toHaveBeenCalledWith('u1', 'i1');
      expect(mockDocuments.generateAndStoreInvoicePdf).not.toHaveBeenCalled();
    });

    it('emails the stored PDF with the booking context', async () => {
      await service.send('u1', bookingIssued, sendDto);
      expect(mockComms.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        attachments: [{ filename: 'INV-2026-001.pdf', content: pdfBuffer }],
        to: sendDto.to,
        subject: sendDto.subject,
        bookingId: 'b1',
        documentId: 'doc-stored',
      }));
    });

    it('omits bookingId in sendEmail for series invoices', async () => {
      await service.send('u1', seriesIssued, sendDto);
      const [callArgs] = mockComms.sendEmail.mock.calls[0];
      expect(callArgs.bookingId).toBeUndefined();
    });

    it('throws BadRequestException when the ISSUED invoice has no stored PDF', async () => {
      mockDocuments.getStoredInvoicePdfBuffer.mockResolvedValue(null);
      await expect(service.send('u1', bookingIssued, sendDto)).rejects.toThrow(BadRequestException);
      expect(mockComms.sendEmail).not.toHaveBeenCalled();
    });

    it('marks SENT after the email succeeds', async () => {
      await service.send('u1', bookingIssued, sendDto);
      expect(mockRepo.markSentById).toHaveBeenCalledWith('i1');
    });

    it('does not mark SENT when the email fails', async () => {
      mockComms.sendEmail.mockRejectedValue(new Error('email error'));
      await expect(service.send('u1', bookingIssued, sendDto)).rejects.toThrow('email error');
      expect(mockRepo.markSentById).not.toHaveBeenCalled();
    });
  });

  // ─── markSent ────────────────────────────────────────────────────────────────

  describe('markSent', () => {
    it('throws BadRequestException when invoice is not ISSUED', async () => {
      await expect(service.markSent(bookingDraft, {})).rejects.toThrow(BadRequestException);
    });

    it('marks SENT for an ISSUED booking invoice', async () => {
      await service.markSent(bookingIssued, {});
      expect(mockRepo.markSentById).toHaveBeenCalledWith('i1');
    });

    it('works for series invoices', async () => {
      await service.markSent(seriesIssued, {});
      expect(mockRepo.markSentById).toHaveBeenCalledWith('i2');
    });
  });

  // ─── markPaid ────────────────────────────────────────────────────────────────

  describe('markPaid', () => {
    it('throws BadRequestException when invoice is not SENT', async () => {
      await expect(service.markPaid(bookingDraft)).rejects.toThrow(BadRequestException);
      expect(mockRepo.markPaidBase).not.toHaveBeenCalled();
    });

    it('marks the invoice paid', async () => {
      await service.markPaid(bookingSent);
      expect(mockRepo.markPaidBase).toHaveBeenCalledWith('i1');
    });

    it('stamps depositReceivedAt for a deposit booking invoice', async () => {
      await service.markPaid(bookingDepositSent);
      expect(mockRepo.setBookingDepositReceivedAt).toHaveBeenCalledWith('b1');
      expect(mockReeval.onBookingChanged).toHaveBeenCalledWith('b1');
    });

    it('does not stamp depositReceivedAt for a balance booking invoice, but still re-evaluates', async () => {
      await service.markPaid(bookingSent);
      expect(mockRepo.setBookingDepositReceivedAt).not.toHaveBeenCalled();
      expect(mockReeval.onBookingChanged).toHaveBeenCalledWith('b1');
    });

    it('neither stamps a deposit nor re-evaluates for a series invoice (ADR-0063)', async () => {
      await service.markPaid(seriesSent);
      expect(mockRepo.markPaidBase).toHaveBeenCalledWith('i2');
      expect(mockRepo.setBookingDepositReceivedAt).not.toHaveBeenCalled();
      expect(mockReeval.onBookingChanged).not.toHaveBeenCalled();
    });

    it('returns the paid invoice', async () => {
      const result = await service.markPaid(bookingSent);
      expect(result).toEqual(bookingPaid);
    });
  });

  // ─── voidInvoice ───────────────────────────────────────────────────────────

  describe('voidInvoice', () => {
    it('throws BadRequestException for a DRAFT invoice', async () => {
      await expect(service.voidInvoice(bookingDraft)).rejects.toThrow(BadRequestException);
      expect(mockRepo.voidInvoice).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an already-VOID invoice', async () => {
      await expect(service.voidInvoice(bookingVoided)).rejects.toThrow(BadRequestException);
      expect(mockRepo.voidInvoice).not.toHaveBeenCalled();
    });

    it('voids an ISSUED invoice', async () => {
      await service.voidInvoice(bookingIssued);
      expect(mockRepo.voidInvoice).toHaveBeenCalledWith('i1');
    });

    it('voids a PAID invoice', async () => {
      await service.voidInvoice(bookingPaid);
      expect(mockRepo.voidInvoice).toHaveBeenCalledWith('i1');
    });

    it('resets create_deposit_invoice and re-evaluates when no active deposit invoice remains', async () => {
      mockRepo.countActiveByType.mockResolvedValue(0);
      await service.voidInvoice(bookingDepositSent);
      expect(mockRepo.countActiveByType).toHaveBeenCalledWith('b1', true);
      expect(mockChecklistRepo.resetItemByKey).toHaveBeenCalledWith('b1', 'create_deposit_invoice');
      expect(mockReeval.onBookingChanged).toHaveBeenCalledWith('b1');
    });

    it('resets create_balance_invoice for a balance invoice with none remaining', async () => {
      mockRepo.countActiveByType.mockResolvedValue(0);
      await service.voidInvoice(bookingSent);
      expect(mockChecklistRepo.resetItemByKey).toHaveBeenCalledWith('b1', 'create_balance_invoice');
    });

    it('does not reset the checklist item when another active invoice of the same type remains', async () => {
      mockRepo.countActiveByType.mockResolvedValue(1);
      await service.voidInvoice(bookingSent);
      expect(mockChecklistRepo.resetItemByKey).not.toHaveBeenCalled();
      expect(mockReeval.onBookingChanged).toHaveBeenCalledWith('b1');
    });

    it('for a series invoice: no checklist reset and no re-evaluation, by construction (ADR-0063)', async () => {
      await service.voidInvoice(seriesSent);
      expect(mockRepo.voidInvoice).toHaveBeenCalledWith('i2');
      expect(mockRepo.countActiveByType).not.toHaveBeenCalled();
      expect(mockChecklistRepo.resetItemByKey).not.toHaveBeenCalled();
      expect(mockReeval.onBookingChanged).not.toHaveBeenCalled();
    });
  });
});
