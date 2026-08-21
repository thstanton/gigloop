import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import type { DocumentsService } from '../documents/documents.service';
import type { InvoiceTransitionService } from './invoice-transition.service';

type MockRepo = {
  findBookingCustomerId: jest.Mock;
  findBookingInfo: jest.Mock;
  findAll: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  assignAndMarkSent: jest.Mock;
  assignAndMarkIssued: jest.Mock;
  assignInvoiceNumberOnly: jest.Mock;
  markSentById: jest.Mock;
  markPaidBase: jest.Mock;
  voidInvoice: jest.Mock;
  countActiveByType: jest.Mock;
  getUserPaymentTerms: jest.Mock;
  findLineItem: jest.Mock;
  addLineItem: jest.Mock;
  updateLineItem: jest.Mock;
  deleteLineItem: jest.Mock;
  previewBookingInvoiceNumber: jest.Mock;
  previewSeriesInvoiceNumber: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findBookingCustomerId: jest.fn(),
    findBookingInfo: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    assignAndMarkSent: jest.fn(),
    assignAndMarkIssued: jest.fn(),
    assignInvoiceNumberOnly: jest.fn(),
    markSentById: jest.fn(),
    markPaidBase: jest.fn(),
    voidInvoice: jest.fn(),
    countActiveByType: jest.fn(),
    getUserPaymentTerms: jest.fn().mockResolvedValue(14),
    findLineItem: jest.fn(),
    addLineItem: jest.fn(),
    updateLineItem: jest.fn(),
    deleteLineItem: jest.fn(),
    previewBookingInvoiceNumber: jest.fn(),
    previewSeriesInvoiceNumber: jest.fn(),
  };
}

const mockDocuments = {
  generatePreviewPdf: jest.fn(),
  findByInvoice: jest.fn(),
} as unknown as DocumentsService;

const draftInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'DRAFT', isDeposit: false, invoiceNumber: null };
const issuedInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'ISSUED', isDeposit: false, invoiceNumber: 'INV-2026-001' };
const seriesInvoice = { id: 'si1', bookingId: null, seriesId: 's1', userId: 'u1', status: 'DRAFT', isDeposit: false, invoiceNumber: null };

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repo: MockRepo;
  let mockTransition: {
    send: jest.Mock;
    markSent: jest.Mock;
    markPaid: jest.Mock;
    correctPayment: jest.Mock;
    voidInvoice: jest.Mock;
    issueInvoice: jest.Mock;
  };
  let mockContacts: { assertOwned: jest.Mock };

  beforeEach(() => {
    repo = makeRepo();
    mockTransition = {
      send: jest.fn().mockResolvedValue(undefined),
      markSent: jest.fn().mockResolvedValue({ ...draftInvoice, status: 'SENT', invoiceNumber: 'INV-2026-001' }),
      markPaid: jest.fn().mockResolvedValue({ ...draftInvoice, status: 'PAID' }),
      correctPayment: jest.fn().mockResolvedValue({ ...draftInvoice, status: 'PAID' }),
      voidInvoice: jest.fn().mockResolvedValue({ ...draftInvoice, status: 'VOID', invoiceNumber: 'INV-2026-001' }),
      issueInvoice: jest.fn().mockResolvedValue(issuedInvoice),
    };
    const mockEvaluator = { onBookingChanged: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-reevaluator.service').ChecklistReevaluator;
    mockContacts = { assertOwned: jest.fn().mockResolvedValue(undefined) };
    service = new InvoicesService(
      repo as unknown as InvoicesRepository,
      mockTransition as unknown as InvoiceTransitionService,
      mockDocuments,
      mockEvaluator,
      mockContacts as unknown as import('../contacts/contacts.service').ContactsService,
    );
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([draftInvoice]);
      const result = await service.findAll('u1', 'b1');
      expect(repo.findAll).toHaveBeenCalledWith('u1', 'b1');
      expect(result).toEqual([draftInvoice]);
    });
  });

  // ADR-0069: resolving an existing invoice by id alone, with the owner read off the row.
  describe('findById', () => {
    it('resolves a booking invoice without being told its booking', async () => {
      repo.findById.mockResolvedValue(draftInvoice);
      const result = await service.findById('u1', 'i1');
      expect(repo.findById).toHaveBeenCalledWith('u1', 'i1');
      expect(result).toBe(draftInvoice);
    });

    // The whole point of the route: a series invoice has `bookingId: null`, so no
    // booking-scoped read can ever reach it (#844).
    it('resolves a series invoice, which the booking-scoped read cannot reach', async () => {
      repo.findById.mockResolvedValue(seriesInvoice);
      const result = await service.findById('u1', 'si1');
      expect(repo.findById).toHaveBeenCalledWith('u1', 'si1');
      expect(result).toBe(seriesInvoice);
    });

    it('throws NotFoundException when no invoice has that id', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    // Tenancy is carried by the userId predicate in the repository, so another tenant's
    // invoice is indistinguishable from a non-existent one — deliberately.
    it('throws NotFoundException for another tenant, scoping by the caller userId', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('u2', 'i1')).rejects.toThrow(NotFoundException);
      expect(repo.findById).toHaveBeenCalledWith('u2', 'i1');
    });
  });

  // ADR-0069 write half (#845). Before these routes existed, `PATCH` and the three line-item
  // operations lived only under /bookings/:bookingId/invoices, so a series invoice's lines
  // could not be edited by any route at all.
  describe('owner-agnostic writes', () => {
    describe('updateById', () => {
      it('updates a series invoice, resolving it by id alone', async () => {
        repo.findById.mockResolvedValue(seriesInvoice);
        repo.update.mockResolvedValue(seriesInvoice);
        await service.updateById('u1', 'si1', { billToContactId: 'c1' });
        expect(repo.findById).toHaveBeenCalledWith('u1', 'si1');
        expect(repo.update).toHaveBeenCalledWith('si1', { billToContactId: 'c1' });
      });

      it('applies the same DRAFT guard as the owner-scoped route', async () => {
        repo.findById.mockResolvedValue(issuedInvoice);
        await expect(service.updateById('u1', 'i1', {})).rejects.toThrow(BadRequestException);
        expect(repo.update).not.toHaveBeenCalled();
      });

      it('404s for another tenant rather than updating', async () => {
        repo.findById.mockResolvedValue(null);
        await expect(service.updateById('u2', 'si1', {})).rejects.toThrow(NotFoundException);
        expect(repo.update).not.toHaveBeenCalled();
      });

      it('still validates a re-pointed billTo contact belongs to the caller (#709)', async () => {
        repo.findById.mockResolvedValue(seriesInvoice);
        repo.update.mockResolvedValue(seriesInvoice);
        await service.updateById('u1', 'si1', { billToContactId: 'c9' });
        expect(mockContacts.assertOwned).toHaveBeenCalledWith('u1', ['c9']);
      });
    });

    describe('addLineItemById', () => {
      it('adds a custom line to a series invoice', async () => {
        repo.findById.mockResolvedValue(seriesInvoice);
        repo.addLineItem.mockResolvedValue({ id: 'new' });
        await service.addLineItemById('u1', 'si1', { description: 'PA hire', amount: 200 });
        expect(repo.addLineItem).toHaveBeenCalledWith('u1', 'si1', { description: 'PA hire', amount: 200 });
      });

      it('refuses once the invoice is no longer a draft', async () => {
        repo.findById.mockResolvedValue(issuedInvoice);
        await expect(
          service.addLineItemById('u1', 'i1', { description: 'PA hire', amount: 200 }),
        ).rejects.toThrow(BadRequestException);
        expect(repo.addLineItem).not.toHaveBeenCalled();
      });

      it('404s for another tenant', async () => {
        repo.findById.mockResolvedValue(null);
        await expect(
          service.addLineItemById('u2', 'si1', { description: 'PA hire', amount: 200 }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('updateLineItemById', () => {
      it('updates a line on a series invoice', async () => {
        repo.findById.mockResolvedValue(seriesInvoice);
        repo.findLineItem.mockResolvedValue({ id: 'li1' });
        repo.updateLineItem.mockResolvedValue({ id: 'li1' });
        await service.updateLineItemById('u1', 'si1', 'li1', { amount: 1750 });
        expect(repo.findLineItem).toHaveBeenCalledWith('u1', 'si1', 'li1');
        expect(repo.updateLineItem).toHaveBeenCalledWith('li1', { amount: 1750 });
      });

      // The line lookup is itself userId-scoped, so a line belonging to someone else's
      // invoice cannot be reached even with a valid invoice id.
      it('404s when the line does not belong to the caller', async () => {
        repo.findById.mockResolvedValue(seriesInvoice);
        repo.findLineItem.mockResolvedValue(null);
        await expect(service.updateLineItemById('u1', 'si1', 'nope', {})).rejects.toThrow(NotFoundException);
        expect(repo.updateLineItem).not.toHaveBeenCalled();
      });

      it('refuses once the invoice is no longer a draft', async () => {
        repo.findById.mockResolvedValue(issuedInvoice);
        await expect(service.updateLineItemById('u1', 'i1', 'li1', {})).rejects.toThrow(BadRequestException);
        expect(repo.findLineItem).not.toHaveBeenCalled();
      });
    });

    describe('deleteLineItemById', () => {
      it('deletes a line from a series invoice', async () => {
        repo.findById.mockResolvedValue(seriesInvoice);
        repo.findLineItem.mockResolvedValue({ id: 'li1' });
        repo.deleteLineItem.mockResolvedValue(undefined);
        await service.deleteLineItemById('u1', 'si1', 'li1');
        expect(repo.deleteLineItem).toHaveBeenCalledWith('li1');
      });

      it('refuses once the invoice is no longer a draft', async () => {
        repo.findById.mockResolvedValue(issuedInvoice);
        await expect(service.deleteLineItemById('u1', 'i1', 'li1')).rejects.toThrow(BadRequestException);
        expect(repo.deleteLineItem).not.toHaveBeenCalled();
      });
    });
  });

  describe('generatePreviewPdfById', () => {
    beforeEach(() => {
      (mockDocuments.generatePreviewPdf as jest.Mock).mockResolvedValue(Buffer.from('pdf'));
    });

    it('renders a draft preview with the provisional booking number, derived from the invoice', async () => {
      repo.findById.mockResolvedValue(draftInvoice);
      repo.previewBookingInvoiceNumber.mockResolvedValue({ invoiceNumber: 'INV-2026-007', willReuse: false });
      await service.generatePreviewPdfById('u1', 'i1');
      expect(repo.previewBookingInvoiceNumber).toHaveBeenCalledWith('u1', 'b1', false);
      expect(mockDocuments.generatePreviewPdf).toHaveBeenCalledWith('u1', 'i1', 'INV-2026-007');
    });

    it('uses the series preview number for a draft series invoice', async () => {
      repo.findById.mockResolvedValue({ ...draftInvoice, seriesId: 'ser1' });
      repo.previewSeriesInvoiceNumber.mockResolvedValue({ invoiceNumber: 'INV-2026-009', willReuse: false });
      await service.generatePreviewPdfById('u1', 'i1');
      expect(repo.previewSeriesInvoiceNumber).toHaveBeenCalledWith('u1', 'ser1');
      expect(mockDocuments.generatePreviewPdf).toHaveBeenCalledWith('u1', 'i1', 'INV-2026-009');
    });

    it('passes no provisional number when the invoice already has one', async () => {
      repo.findById.mockResolvedValue(issuedInvoice);
      await service.generatePreviewPdfById('u1', 'i1');
      expect(repo.previewBookingInvoiceNumber).not.toHaveBeenCalled();
      expect(mockDocuments.generatePreviewPdf).toHaveBeenCalledWith('u1', 'i1', undefined);
    });
  });

  describe('getDocumentById', () => {
    it('delegates to documents.findByInvoice', async () => {
      const doc = { id: 'd1', createdAt: new Date(), url: '/documents/d1/download' };
      (mockDocuments.findByInvoice as jest.Mock).mockResolvedValue(doc);
      const result = await service.getDocumentById('u1', 'i1');
      expect(mockDocuments.findByInvoice).toHaveBeenCalledWith('u1', 'i1');
      expect(result).toBe(doc);
    });

    // findByInvoice is already userId-scoped, so another tenant's invoice and "no document
    // yet" (a DRAFT) are indistinguishable here — both resolve to null.
    it('returns null when there is no stored document', async () => {
      (mockDocuments.findByInvoice as jest.Mock).mockResolvedValue(null);
      const result = await service.getDocumentById('u1', 'missing');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    beforeEach(() => {
      repo.findBookingInfo.mockResolvedValue({ customerId: 'c1', seriesId: null });
      repo.countActiveByType.mockResolvedValue(0);
      repo.create.mockResolvedValue(draftInvoice);
    });

    it('defaults billToContactId to the booking customerId when not provided', async () => {
      await service.create('u1', 'b1', {});
      expect(repo.create).toHaveBeenCalledWith('u1', 'b1', 'c1', {});
    });

    it('uses the provided billToContactId instead of the booking customer', async () => {
      await service.create('u1', 'b1', { billToContactId: 'c2' });
      expect(repo.create).toHaveBeenCalledWith('u1', 'b1', 'c2', { billToContactId: 'c2' });
    });

    it('validates ownership of an explicitly-provided billToContactId (#709)', async () => {
      await service.create('u1', 'b1', { billToContactId: 'c2' });
      expect(mockContacts.assertOwned).toHaveBeenCalledWith('u1', ['c2']);
    });

    it('does not require a contact check when billToContactId is omitted — the fallback is owned (#709)', async () => {
      await service.create('u1', 'b1', {});
      expect(mockContacts.assertOwned).toHaveBeenCalledWith('u1', [undefined]);
    });

    it('rejects and does not create when the billToContactId is not owned (#709)', async () => {
      mockContacts.assertOwned.mockRejectedValue(new NotFoundException('Contact not found'));
      await expect(service.create('u1', 'b1', { billToContactId: 'foreign' })).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when booking is not found', async () => {
      repo.findBookingInfo.mockResolvedValue(null);
      await expect(service.create('u1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a non-VOID deposit invoice already exists', async () => {
      repo.countActiveByType.mockResolvedValue(1);
      await expect(service.create('u1', 'b1', { isDeposit: true })).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a non-VOID balance invoice already exists', async () => {
      repo.countActiveByType.mockResolvedValue(1);
      await expect(service.create('u1', 'b1', { isDeposit: false })).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('checks the correct isDeposit type when guarding against duplicates', async () => {
      await service.create('u1', 'b1', { isDeposit: true });
      expect(repo.countActiveByType).toHaveBeenCalledWith('b1', true);
    });

    it('throws ConflictException when booking belongs to a series', async () => {
      repo.findBookingInfo.mockResolvedValue({ customerId: 'c1', seriesId: 's1' });
      await expect(service.create('u1', 'b1', {})).rejects.toThrow(
        new ConflictException('This booking is part of a series — invoices are managed at the series level'),
      );
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  // `update`, `addLineItem`, `updateLineItem` and `deleteLineItem` (booking-scoped) were removed
  // in #853 — their owner-agnostic `*ById` replacements are covered above, under
  // "owner-agnostic writes".

  describe('deleteById', () => {
    it('deletes when invoice is DRAFT', async () => {
      repo.findById.mockResolvedValue(draftInvoice);
      repo.delete.mockResolvedValue(draftInvoice);
      await service.deleteById('u1', 'i1');
      expect(repo.delete).toHaveBeenCalledWith('i1');
    });

    it('throws BadRequestException when invoice is ISSUED (must void instead)', async () => {
      repo.findById.mockResolvedValue(issuedInvoice);
      await expect(service.deleteById('u1', 'i1')).rejects.toThrow(BadRequestException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException without deleting when invoice is not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.deleteById('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('issueById', () => {
    // issueById() now loads the invoice once for ownership/validation, then hands it to the
    // transition service — which owns date resolution, number allocation, PDF and re-eval
    // (ADR-0063). The service is a thin fetch → delegate → return.
    beforeEach(() => {
      repo.findById.mockResolvedValue(draftInvoice);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findById.mockReset();
      repo.findById.mockResolvedValue(null);
      await expect(service.issueById('u1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(mockTransition.issueInvoice).not.toHaveBeenCalled();
    });

    it('delegates to transition.issueInvoice with userId, invoice and dto', async () => {
      const dto = { issueDate: '2026-06-01', dueDate: '2026-06-15' };
      await service.issueById('u1', 'i1', dto);
      expect(mockTransition.issueInvoice).toHaveBeenCalledWith('u1', draftInvoice, dto);
    });

    it('returns the issued invoice from the transition write without re-fetching', async () => {
      const result = await service.issueById('u1', 'i1', {});
      expect(result).toBe(issuedInvoice);
      // Only the initial ownership/validation load — no second findById re-fetch (#591).
      expect(repo.findById).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendById', () => {
    const dto = {
      issueDate: '2026-05-26', dueDate: '2026-06-09',
      to: 'client@example.com', contactId: 'c1',
      subject: 'Invoice INV-2026-001', body: '<p>Please find attached</p>',
    };

    beforeEach(() => {
      repo.findById.mockResolvedValue(issuedInvoice);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.sendById('u1', 'missing', dto)).rejects.toThrow(NotFoundException);
      expect(mockTransition.send).not.toHaveBeenCalled();
    });

    it('delegates to transition.send with userId, invoice, and dto', async () => {
      await service.sendById('u1', 'i1', dto);
      expect(mockTransition.send).toHaveBeenCalledWith('u1', issuedInvoice, dto);
    });
  });

  describe('markSentById', () => {
    const dto = { issueDate: '2026-05-26', dueDate: '2026-06-09' };

    beforeEach(() => {
      repo.findById.mockResolvedValue(issuedInvoice);
      repo.assignAndMarkSent.mockResolvedValue({ ...draftInvoice, status: 'SENT', invoiceNumber: 'INV-2026-001' });
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.markSentById('u1', 'missing', dto)).rejects.toThrow(NotFoundException);
      expect(mockTransition.markSent).not.toHaveBeenCalled();
    });

    it('delegates to transition.markSent', async () => {
      await service.markSentById('u1', 'i1', dto);
      expect(mockTransition.markSent).toHaveBeenCalledWith(issuedInvoice, dto);
    });

    it('delegates to transition.markSent with empty dto', async () => {
      await service.markSentById('u1', 'i1', {});
      expect(mockTransition.markSent).toHaveBeenCalledWith(issuedInvoice, {});
    });
  });

  describe('markPaidById', () => {
    // Side-effects (deposit stamp, re-eval) are field-derived inside the transition service —
    // see invoice-transition.service.spec.ts. Here the service is a thin fetch → delegate.
    const sentInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'SENT', isDeposit: false, invoiceNumber: 'INV-2026-001' };
    const paidInvoice = { ...sentInvoice, status: 'PAID' };

    beforeEach(() => {
      repo.findById.mockResolvedValue(sentInvoice);
      mockTransition.markPaid.mockResolvedValue(paidInvoice);
    });

    const dto = { paidAt: '2026-08-18', paymentReference: 'BACS-4417' };

    it('throws NotFoundException when invoice not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.markPaidById('u1', 'missing', dto)).rejects.toThrow(NotFoundException);
      expect(mockTransition.markPaid).not.toHaveBeenCalled();
    });

    it('delegates to transition.markPaid with the loaded invoice and the dto', async () => {
      await service.markPaidById('u1', 'i1', dto);
      expect(mockTransition.markPaid).toHaveBeenCalledWith(sentInvoice, dto);
    });

    it('returns the paid invoice', async () => {
      const result = await service.markPaidById('u1', 'i1', dto);
      expect(result).toBe(paidInvoice);
    });
  });

  describe('correctPaymentById', () => {
    const paidInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'PAID', isDeposit: false, invoiceNumber: 'INV-2026-001' };
    const dto = { paidAt: '2026-08-02', paymentReference: 'BACS-9' };

    beforeEach(() => {
      repo.findById.mockResolvedValue(paidInvoice);
      mockTransition.correctPayment.mockResolvedValue(paidInvoice);
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.correctPaymentById('u1', 'missing', dto)).rejects.toThrow(NotFoundException);
      expect(mockTransition.correctPayment).not.toHaveBeenCalled();
    });

    it('delegates to transition.correctPayment with the loaded invoice and the dto', async () => {
      await service.correctPaymentById('u1', 'i1', dto);
      expect(mockTransition.correctPayment).toHaveBeenCalledWith(paidInvoice, dto);
    });
  });

  describe('voidInvoiceById', () => {
    // State-guard + checklist-reset + re-eval are field-derived inside the transition service —
    // see invoice-transition.service.spec.ts. Here the service is a thin fetch → delegate.
    const sentInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'SENT', isDeposit: true, invoiceNumber: 'INV-2026-001' };
    const voidedInvoice = { ...sentInvoice, status: 'VOID' };

    beforeEach(() => {
      repo.findById.mockResolvedValue(sentInvoice);
      mockTransition.voidInvoice.mockResolvedValue(voidedInvoice);
    });

    it('delegates to transition.voidInvoice with the loaded invoice', async () => {
      await service.voidInvoiceById('u1', 'i1');
      expect(mockTransition.voidInvoice).toHaveBeenCalledWith(sentInvoice);
    });

    it('returns the voided invoice', async () => {
      const result = await service.voidInvoiceById('u1', 'i1');
      expect(result).toBe(voidedInvoice);
    });

    it('throws NotFoundException when invoice does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.voidInvoiceById('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(mockTransition.voidInvoice).not.toHaveBeenCalled();
    });
  });
});
