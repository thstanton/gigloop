import { BadRequestException } from '@nestjs/common';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import { InvoicesRepository } from './invoices.repository';
import { DocumentsService } from '../documents/documents.service';
import { CommunicationsService } from '../communications/communications.service';

const draftInvoice = { id: 'i1', status: 'DRAFT' as const, invoiceNumber: null, bookingId: 'b1' };
const issuedInvoice = { id: 'i1', status: 'ISSUED' as const, invoiceNumber: 'INV-2026-001', bookingId: 'b1' };
const sentInvoice = { id: 'i1', status: 'SENT' as const, invoiceNumber: 'INV-2026-001', bookingId: 'b1' };
const paidInvoice = { id: 'i1', status: 'PAID' as const, invoiceNumber: 'INV-2026-001', bookingId: 'b1' };
const voidedInvoice = { id: 'i1', status: 'VOID' as const, invoiceNumber: 'INV-2026-001', bookingId: 'b1' };

const seriesDraftInvoice = { id: 'i2', status: 'DRAFT' as const, invoiceNumber: null, bookingId: null };

const pdfBuffer = Buffer.from('%PDF-test');
const numberedInvoice = {
  id: 'i1', invoiceNumber: 'INV-2026-001', issueDate: new Date(), dueDate: null,
  isDeposit: false, bookingId: 'b1',
  billToContact: { name: 'Test Client' },
  lineItems: [{ description: 'Fee', amount: 1000, order: 0 }],
};

const sendDto = {
  issueDate: '2026-06-01', dueDate: '2026-06-15',
  to: 'client@example.com', contactId: 'c1',
  subject: 'Invoice', body: '<p>Hi</p>',
};

describe('InvoiceLifecycleService', () => {
  let service: InvoiceLifecycleService;
  let mockRepo: jest.Mocked<Pick<InvoicesRepository, 'markSentById' | 'markPaidBase' | 'voidInvoice'>>;
  let mockDocuments: {
    generateAndStoreInvoicePdf: jest.Mock;
    getStoredInvoicePdfBuffer: jest.Mock;
  };
  let mockComms: { sendEmail: jest.Mock };

  beforeEach(() => {
    mockRepo = {
      markSentById: jest.fn().mockResolvedValue({ ...sentInvoice, status: 'SENT' }),
      markPaidBase: jest.fn().mockResolvedValue({ ...paidInvoice }),
      voidInvoice: jest.fn().mockResolvedValue({ ...voidedInvoice }),
    };
    mockDocuments = {
      generateAndStoreInvoicePdf: jest.fn().mockResolvedValue({ buffer: pdfBuffer }),
      getStoredInvoicePdfBuffer: jest.fn().mockResolvedValue(pdfBuffer),
    };
    mockComms = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    service = new InvoiceLifecycleService(
      mockRepo as unknown as InvoicesRepository,
      mockDocuments as unknown as DocumentsService,
      mockComms as unknown as CommunicationsService,
    );
  });

  // ─── issueInvoice ──────────────────────────────────────────────────────────

  describe('issueInvoice', () => {
    const assignAndMarkIssued = jest.fn().mockResolvedValue(numberedInvoice);
    const params = { issueDate: new Date('2026-06-01'), dueDate: new Date('2026-06-15') };

    beforeEach(() => assignAndMarkIssued.mockClear());

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      await expect(service.issueInvoice('u1', issuedInvoice, params, assignAndMarkIssued))
        .rejects.toThrow(BadRequestException);
      expect(assignAndMarkIssued).not.toHaveBeenCalled();
    });

    it('calls assignAndMarkIssued with the invoice id and dates', async () => {
      await service.issueInvoice('u1', draftInvoice, params, assignAndMarkIssued);
      expect(assignAndMarkIssued).toHaveBeenCalledWith('i1', params.issueDate, params.dueDate);
    });

    it('generates and stores the invoice PDF after assigning the number', async () => {
      await service.issueInvoice('u1', draftInvoice, params, assignAndMarkIssued);
      expect(mockDocuments.generateAndStoreInvoicePdf)
        .toHaveBeenCalledWith('u1', 'i1', numberedInvoice, 'b1');
    });

    it('passes undefined bookingId to generateAndStoreInvoicePdf for series invoices (series parity is a later slice)', async () => {
      const seriesNumbered = { ...numberedInvoice, id: 'i2', bookingId: null };
      const seriesAssign = jest.fn().mockResolvedValue(seriesNumbered);
      await service.issueInvoice('u1', seriesDraftInvoice, params, seriesAssign);
      expect(mockDocuments.generateAndStoreInvoicePdf)
        .toHaveBeenCalledWith('u1', 'i2', seriesNumbered, undefined);
    });

    it('does not call generateAndStoreInvoicePdf when assignAndMarkIssued fails', async () => {
      assignAndMarkIssued.mockRejectedValue(new Error('db error'));
      await expect(service.issueInvoice('u1', draftInvoice, params, assignAndMarkIssued)).rejects.toThrow('db error');
      expect(mockDocuments.generateAndStoreInvoicePdf).not.toHaveBeenCalled();
    });
  });

  // ─── send ──────────────────────────────────────────────────────────────────

  describe('send', () => {
    const assignNumberOnly = jest.fn().mockResolvedValue(numberedInvoice);

    beforeEach(() => {
      assignNumberOnly.mockClear();
      mockDocuments.getStoredInvoicePdfBuffer.mockResolvedValue(pdfBuffer);
    });

    it('throws BadRequestException when invoice is not sendable (SENT)', async () => {
      await expect(service.send('u1', sentInvoice, sendDto, assignNumberOnly))
        .rejects.toThrow(BadRequestException);
      expect(assignNumberOnly).not.toHaveBeenCalled();
    });

    // ─── ISSUED path ───────────────────────────────────────────────────────

    it('retrieves stored PDF for ISSUED invoices without calling assignNumberOnly', async () => {
      await service.send('u1', issuedInvoice, sendDto, assignNumberOnly);
      expect(assignNumberOnly).not.toHaveBeenCalled();
      expect(mockDocuments.getStoredInvoicePdfBuffer).toHaveBeenCalledWith('u1', 'i1');
      expect(mockDocuments.generateAndStoreInvoicePdf).not.toHaveBeenCalled();
    });

    it('sends email with the stored PDF for ISSUED invoices', async () => {
      await service.send('u1', issuedInvoice, sendDto, assignNumberOnly);
      expect(mockComms.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        attachments: [{ filename: 'INV-2026-001.pdf', content: pdfBuffer }],
      }));
    });

    it('throws BadRequestException when ISSUED invoice has no stored PDF', async () => {
      mockDocuments.getStoredInvoicePdfBuffer.mockResolvedValue(null);
      await expect(service.send('u1', issuedInvoice, sendDto, assignNumberOnly))
        .rejects.toThrow(BadRequestException);
      expect(mockComms.sendEmail).not.toHaveBeenCalled();
    });

    // ─── DRAFT path (series compat) ────────────────────────────────────────

    it('calls assignNumberOnly with parsed dates for DRAFT invoices', async () => {
      await service.send('u1', draftInvoice, sendDto, assignNumberOnly);
      expect(assignNumberOnly).toHaveBeenCalledWith(
        'i1', new Date('2026-06-01'), new Date('2026-06-15'),
      );
    });

    it('calls assignNumberOnly with null dueDate when not provided', async () => {
      await service.send('u1', draftInvoice, { ...sendDto, dueDate: undefined }, assignNumberOnly);
      expect(assignNumberOnly).toHaveBeenCalledWith('i1', expect.any(Date), null);
    });

    it('calls generateAndStoreInvoicePdf with the numbered invoice and bookingId for DRAFT', async () => {
      await service.send('u1', draftInvoice, sendDto, assignNumberOnly);
      expect(mockDocuments.generateAndStoreInvoicePdf)
        .toHaveBeenCalledWith('u1', 'i1', numberedInvoice, 'b1');
    });

    it('calls generateAndStoreInvoicePdf with undefined bookingId for series DRAFT invoices', async () => {
      const seriesNumbered = { ...numberedInvoice, id: 'i2', bookingId: null };
      const seriesAssign = jest.fn().mockResolvedValue(seriesNumbered);
      await service.send('u1', seriesDraftInvoice, sendDto, seriesAssign);
      expect(mockDocuments.generateAndStoreInvoicePdf)
        .toHaveBeenCalledWith('u1', 'i2', seriesNumbered, undefined);
    });

    it('sends email with generated PDF attachment named after the invoice number for DRAFT', async () => {
      await service.send('u1', draftInvoice, sendDto, assignNumberOnly);
      expect(mockComms.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        attachments: [{ filename: 'INV-2026-001.pdf', content: pdfBuffer }],
        to: sendDto.to,
        subject: sendDto.subject,
        bookingId: 'b1',
      }));
    });

    it('omits bookingId in sendEmail for series invoices', async () => {
      const seriesNumbered = { ...numberedInvoice, id: 'i2', bookingId: null };
      const seriesAssign = jest.fn().mockResolvedValue(seriesNumbered);
      await service.send('u1', seriesDraftInvoice, sendDto, seriesAssign);
      const callArgs = mockComms.sendEmail.mock.calls[0][0];
      expect(callArgs.bookingId).toBeUndefined();
    });

    it('calls markSentById after email succeeds', async () => {
      await service.send('u1', draftInvoice, sendDto, assignNumberOnly);
      expect(mockRepo.markSentById).toHaveBeenCalledWith('i1');
    });

    it('does not call markSentById when PDF generation fails', async () => {
      mockDocuments.generateAndStoreInvoicePdf.mockRejectedValue(new Error('pdf error'));
      await expect(service.send('u1', draftInvoice, sendDto, assignNumberOnly)).rejects.toThrow('pdf error');
      expect(mockRepo.markSentById).not.toHaveBeenCalled();
    });

    it('does not call markSentById when email fails', async () => {
      mockComms.sendEmail.mockRejectedValue(new Error('email error'));
      await expect(service.send('u1', draftInvoice, sendDto, assignNumberOnly)).rejects.toThrow('email error');
      expect(mockRepo.markSentById).not.toHaveBeenCalled();
    });
  });

  // ─── markSent ──────────────────────────────────────────────────────────────

  describe('markSent', () => {
    const atomicMarkSent = jest.fn().mockResolvedValue(sentInvoice);
    const dto = { issueDate: '2026-06-01', dueDate: '2026-06-15' };

    beforeEach(() => atomicMarkSent.mockClear());

    it('throws BadRequestException when invoice is not sendable (SENT)', async () => {
      await expect(service.markSent(sentInvoice, dto, atomicMarkSent))
        .rejects.toThrow(BadRequestException);
      expect(atomicMarkSent).not.toHaveBeenCalled();
    });

    // ─── ISSUED path ───────────────────────────────────────────────────────

    it('calls markSentById directly for ISSUED invoices without calling atomicMarkSent', async () => {
      await service.markSent(issuedInvoice, dto, atomicMarkSent);
      expect(mockRepo.markSentById).toHaveBeenCalledWith('i1');
      expect(atomicMarkSent).not.toHaveBeenCalled();
    });

    it('returns the updated invoice for ISSUED invoices', async () => {
      const result = await service.markSent(issuedInvoice, dto, atomicMarkSent);
      expect(result).toEqual({ ...sentInvoice, status: 'SENT' });
    });

    // ─── DRAFT path (series compat) ────────────────────────────────────────

    it('calls atomicMarkSent with parsed dates for DRAFT invoices', async () => {
      await service.markSent(draftInvoice, dto, atomicMarkSent);
      expect(atomicMarkSent).toHaveBeenCalledWith(
        'i1', new Date('2026-06-01'), new Date('2026-06-15'),
      );
    });

    it('calls atomicMarkSent with null dueDate when not provided', async () => {
      await service.markSent(draftInvoice, { issueDate: '2026-06-01' }, atomicMarkSent);
      expect(atomicMarkSent).toHaveBeenCalledWith('i1', expect.any(Date), null);
    });

    it('returns the result of atomicMarkSent for DRAFT invoices', async () => {
      const result = await service.markSent(draftInvoice, dto, atomicMarkSent);
      expect(result).toBe(sentInvoice);
    });
  });

  // ─── markPaid ──────────────────────────────────────────────────────────────

  describe('markPaid', () => {
    it('throws BadRequestException when invoice is not SENT', async () => {
      await expect(service.markPaid(draftInvoice)).rejects.toThrow(BadRequestException);
      expect(mockRepo.markPaidBase).not.toHaveBeenCalled();
    });

    it('calls markPaidBase', async () => {
      await service.markPaid(sentInvoice);
      expect(mockRepo.markPaidBase).toHaveBeenCalledWith('i1');
    });

    it('invokes onCommit after marking paid', async () => {
      const onCommit = jest.fn().mockResolvedValue(undefined);
      await service.markPaid(sentInvoice, onCommit);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it('does not call onCommit if markPaidBase fails', async () => {
      mockRepo.markPaidBase.mockRejectedValue(new Error('db error'));
      const onCommit = jest.fn();
      await expect(service.markPaid(sentInvoice, onCommit)).rejects.toThrow('db error');
      expect(onCommit).not.toHaveBeenCalled();
    });

    it('returns the updated invoice', async () => {
      const result = await service.markPaid(sentInvoice);
      expect(result).toEqual(paidInvoice);
    });
  });

  // ─── voidInvoice ───────────────────────────────────────────────────────────

  describe('voidInvoice', () => {
    it('throws BadRequestException for a DRAFT invoice', async () => {
      await expect(service.voidInvoice(draftInvoice)).rejects.toThrow(BadRequestException);
      expect(mockRepo.voidInvoice).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an already-VOID invoice', async () => {
      await expect(service.voidInvoice(voidedInvoice)).rejects.toThrow(BadRequestException);
      expect(mockRepo.voidInvoice).not.toHaveBeenCalled();
    });

    it('voids an ISSUED invoice', async () => {
      const result = await service.voidInvoice(issuedInvoice);
      expect(mockRepo.voidInvoice).toHaveBeenCalledWith('i1');
      expect(result).toEqual(voidedInvoice);
    });

    it('voids a SENT invoice', async () => {
      const result = await service.voidInvoice(sentInvoice);
      expect(mockRepo.voidInvoice).toHaveBeenCalledWith('i1');
      expect(result).toEqual(voidedInvoice);
    });

    it('voids a PAID invoice', async () => {
      await service.voidInvoice(paidInvoice);
      expect(mockRepo.voidInvoice).toHaveBeenCalledWith('i1');
    });
  });
});
