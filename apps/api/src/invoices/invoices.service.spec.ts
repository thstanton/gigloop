import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import type { DocumentsService } from '../documents/documents.service';
import type { InvoiceLifecycleService } from './invoice-lifecycle.service';

type MockRepo = {
  findBookingCustomerId: jest.Mock;
  findBookingInfo: jest.Mock;
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  assignAndMarkSent: jest.Mock;
  assignAndMarkIssued: jest.Mock;
  assignInvoiceNumberOnly: jest.Mock;
  markSentById: jest.Mock;
  markPaidBase: jest.Mock;
  setBookingDepositReceivedAt: jest.Mock;
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
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    assignAndMarkSent: jest.fn(),
    assignAndMarkIssued: jest.fn(),
    assignInvoiceNumberOnly: jest.fn(),
    markSentById: jest.fn(),
    markPaidBase: jest.fn(),
    setBookingDepositReceivedAt: jest.fn(),
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

const mockDocuments = { generatePreviewPdf: jest.fn() } as unknown as DocumentsService;

const draftInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'DRAFT', isDeposit: false, invoiceNumber: null };
const issuedInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'ISSUED', isDeposit: false, invoiceNumber: 'INV-2026-001' };
const lineItem = { id: 'li1', invoiceId: 'i1', userId: 'u1' };

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repo: MockRepo;
  let mockLifecycle: {
    send: jest.Mock;
    markSent: jest.Mock;
    markPaid: jest.Mock;
    voidInvoice: jest.Mock;
    issueInvoice: jest.Mock;
  };
  let mockChecklistRepo: { resetItemByKey: jest.Mock };
  let mockContacts: { assertOwned: jest.Mock };

  beforeEach(() => {
    repo = makeRepo();
    mockLifecycle = {
      send: jest.fn().mockResolvedValue(undefined),
      markSent: jest.fn().mockResolvedValue({ ...draftInvoice, status: 'SENT', invoiceNumber: 'INV-2026-001' }),
      markPaid: jest.fn().mockResolvedValue({ ...draftInvoice, status: 'PAID' }),
      voidInvoice: jest.fn().mockResolvedValue({ ...draftInvoice, status: 'VOID', invoiceNumber: 'INV-2026-001' }),
      issueInvoice: jest.fn().mockResolvedValue(issuedInvoice),
    };
    const mockEvaluator = { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService;
    mockChecklistRepo = { resetItemByKey: jest.fn().mockResolvedValue({ count: 0 }) };
    mockContacts = { assertOwned: jest.fn().mockResolvedValue(undefined) };
    service = new InvoicesService(
      repo as unknown as InvoicesRepository,
      mockLifecycle as unknown as InvoiceLifecycleService,
      mockDocuments,
      mockEvaluator,
      mockChecklistRepo as unknown as import('../checklist/checklist.repository').ChecklistRepository,
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

  describe('findOne', () => {
    it('returns invoice when found', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      const result = await service.findOne('u1', 'b1', 'i1');
      expect(result).toBe(draftInvoice);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'b1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generatePreviewPdf', () => {
    beforeEach(() => {
      (mockDocuments.generatePreviewPdf as jest.Mock).mockResolvedValue(Buffer.from('pdf'));
    });

    it('renders a draft preview with the provisional booking number', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.previewBookingInvoiceNumber.mockResolvedValue({ invoiceNumber: 'INV-2026-007', willReuse: false });
      await service.generatePreviewPdf('u1', 'b1', 'i1');
      expect(repo.previewBookingInvoiceNumber).toHaveBeenCalledWith('u1', 'b1', false);
      expect(mockDocuments.generatePreviewPdf).toHaveBeenCalledWith('u1', 'i1', 'INV-2026-007');
    });

    it('uses the series preview number for a draft series invoice', async () => {
      repo.findOne.mockResolvedValue({ ...draftInvoice, seriesId: 'ser1' });
      repo.previewSeriesInvoiceNumber.mockResolvedValue({ invoiceNumber: 'INV-2026-009', willReuse: false });
      await service.generatePreviewPdf('u1', 'b1', 'i1');
      expect(repo.previewSeriesInvoiceNumber).toHaveBeenCalledWith('u1', 'ser1');
      expect(mockDocuments.generatePreviewPdf).toHaveBeenCalledWith('u1', 'i1', 'INV-2026-009');
    });

    it('passes no provisional number when the invoice already has one', async () => {
      repo.findOne.mockResolvedValue(issuedInvoice);
      await service.generatePreviewPdf('u1', 'b1', 'i1');
      expect(repo.previewBookingInvoiceNumber).not.toHaveBeenCalled();
      expect(mockDocuments.generatePreviewPdf).toHaveBeenCalledWith('u1', 'i1', undefined);
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

  describe('update', () => {
    it('updates when invoice is DRAFT', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      const updated = { ...draftInvoice };
      repo.update.mockResolvedValue(updated);
      const result = await service.update('u1', 'b1', 'i1', { billToContactId: 'c2' });
      expect(repo.update).toHaveBeenCalledWith('i1', { billToContactId: 'c2' });
      expect(result).toBe(updated);
    });

    it('throws BadRequestException when invoice is ISSUED (locked after issue)', async () => {
      repo.findOne.mockResolvedValue(issuedInvoice);
      await expect(service.update('u1', 'b1', 'i1', {})).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException without calling update when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('u1', 'b1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('validates ownership of a re-pointed billToContactId (#709)', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.update.mockResolvedValue(draftInvoice);
      await service.update('u1', 'b1', 'i1', { billToContactId: 'c2' });
      expect(mockContacts.assertOwned).toHaveBeenCalledWith('u1', ['c2']);
    });

    it('rejects and does not update when the re-pointed billToContactId is not owned (#709)', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      mockContacts.assertOwned.mockRejectedValue(new NotFoundException('Contact not found'));
      await expect(service.update('u1', 'b1', 'i1', { billToContactId: 'foreign' })).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes when invoice is DRAFT', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.delete.mockResolvedValue(draftInvoice);
      await service.delete('u1', 'b1', 'i1');
      expect(repo.delete).toHaveBeenCalledWith('i1');
    });

    it('throws BadRequestException when invoice is ISSUED (must void instead)', async () => {
      repo.findOne.mockResolvedValue(issuedInvoice);
      await expect(service.delete('u1', 'b1', 'i1')).rejects.toThrow(BadRequestException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException without deleting when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete('u1', 'b1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('issue', () => {
    beforeEach(() => {
      // issue() now loads the draft once for ownership/validation and returns the lifecycle
      // write's result — it no longer re-fetches (#591).
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.assignAndMarkIssued.mockResolvedValue(issuedInvoice);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockReset();
      repo.findOne.mockResolvedValue(null);
      await expect(service.issue('u1', 'b1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(mockLifecycle.issueInvoice).not.toHaveBeenCalled();
    });

    it('delegates to lifecycle.issueInvoice', async () => {
      await service.issue('u1', 'b1', 'i1', {});
      expect(mockLifecycle.issueInvoice).toHaveBeenCalledWith(
        'u1',
        draftInvoice,
        expect.objectContaining({ issueDate: expect.any(Date) }),
        expect.any(Function),
      );
    });

    it('defaults issueDate to today when not provided', async () => {
      const before = new Date();
      before.setHours(0, 0, 0, 0);
      await service.issue('u1', 'b1', 'i1', {});
      const [, , { issueDate }] = mockLifecycle.issueInvoice.mock.calls[0];
      expect(issueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('computes dueDate from user payment terms when not provided', async () => {
      repo.getUserPaymentTerms.mockResolvedValue(30);
      await service.issue('u1', 'b1', 'i1', {});
      const [, , { issueDate, dueDate }] = mockLifecycle.issueInvoice.mock.calls[0];
      const expected = new Date(issueDate);
      expected.setDate(expected.getDate() + 30);
      expect(dueDate?.toDateString()).toBe(expected.toDateString());
    });

    it('passes explicit issueDate and dueDate when provided', async () => {
      await service.issue('u1', 'b1', 'i1', { issueDate: '2026-06-01', dueDate: '2026-06-15' });
      const [, , { issueDate, dueDate }] = mockLifecycle.issueInvoice.mock.calls[0];
      expect(issueDate).toEqual(new Date('2026-06-01'));
      expect(dueDate).toEqual(new Date('2026-06-15'));
    });

    it('passes an assignAndMarkIssued callback that calls the repository with booking context', async () => {
      let capturedCallback: ((id: string, issueDate: Date, dueDate: Date | null) => Promise<unknown>) | undefined;
      mockLifecycle.issueInvoice.mockImplementation(
        async (_userId: string, _invoice: unknown, _params: unknown, cb: typeof capturedCallback) => {
          capturedCallback = cb;
        },
      );

      await service.issue('u1', 'b1', 'i1', {});

      const issueDate = new Date('2026-06-01');
      const dueDate = new Date('2026-06-15');
      await capturedCallback!('i1', issueDate, dueDate);

      expect(repo.assignAndMarkIssued).toHaveBeenCalledWith('u1', {
        id: 'i1', bookingId: 'b1', isDeposit: false, issueDate, dueDate,
      });
    });

    it('returns the issued invoice from the lifecycle write without re-fetching', async () => {
      const result = await service.issue('u1', 'b1', 'i1', {});
      expect(result).toBe(issuedInvoice);
      // Only the initial ownership/validation load — no second findOne re-fetch (#591).
      expect(repo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('addLineItem', () => {
    it('adds line item when invoice is DRAFT', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.addLineItem.mockResolvedValue(lineItem);
      const dto = { description: 'Performance fee', amount: 1500 };
      const result = await service.addLineItem('u1', 'b1', 'i1', dto);
      expect(repo.addLineItem).toHaveBeenCalledWith('u1', 'i1', dto);
      expect(result).toBe(lineItem);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.addLineItem('u1', 'b1', 'missing', { description: 'Fee', amount: 100 }),
      ).rejects.toThrow(NotFoundException);
      expect(repo.addLineItem).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      repo.findOne.mockResolvedValue(issuedInvoice);
      await expect(
        service.addLineItem('u1', 'b1', 'i1', { description: 'Fee', amount: 100 }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.addLineItem).not.toHaveBeenCalled();
    });
  });

  describe('updateLineItem', () => {
    it('updates line item when invoice and item both exist', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.findLineItem.mockResolvedValue(lineItem);
      const updated = { ...lineItem, amount: 200 };
      repo.updateLineItem.mockResolvedValue(updated);
      const result = await service.updateLineItem('u1', 'b1', 'i1', 'li1', { amount: 200 });
      expect(repo.updateLineItem).toHaveBeenCalledWith('li1', { amount: 200 });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.updateLineItem('u1', 'b1', 'missing', 'li1', {})).rejects.toThrow(NotFoundException);
      expect(repo.updateLineItem).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when line item is not found', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.findLineItem.mockResolvedValue(null);
      await expect(service.updateLineItem('u1', 'b1', 'i1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.updateLineItem).not.toHaveBeenCalled();
    });

    it('scopes line item lookup to the correct invoice and user', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.findLineItem.mockResolvedValue(lineItem);
      repo.updateLineItem.mockResolvedValue(lineItem);
      await service.updateLineItem('u1', 'b1', 'i1', 'li1', {});
      expect(repo.findLineItem).toHaveBeenCalledWith('u1', 'i1', 'li1');
    });

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      repo.findOne.mockResolvedValue(issuedInvoice);
      repo.findLineItem.mockResolvedValue(lineItem);
      await expect(service.updateLineItem('u1', 'b1', 'i1', 'li1', { amount: 200 })).rejects.toThrow(BadRequestException);
      expect(repo.updateLineItem).not.toHaveBeenCalled();
    });
  });

  describe('deleteLineItem', () => {
    it('deletes line item when invoice and item both exist', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.findLineItem.mockResolvedValue(lineItem);
      repo.deleteLineItem.mockResolvedValue(lineItem);
      await service.deleteLineItem('u1', 'b1', 'i1', 'li1');
      expect(repo.deleteLineItem).toHaveBeenCalledWith('li1');
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deleteLineItem('u1', 'b1', 'missing', 'li1')).rejects.toThrow(NotFoundException);
      expect(repo.deleteLineItem).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when line item is not found', async () => {
      repo.findOne.mockResolvedValue(draftInvoice);
      repo.findLineItem.mockResolvedValue(null);
      await expect(service.deleteLineItem('u1', 'b1', 'i1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.deleteLineItem).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      repo.findOne.mockResolvedValue(issuedInvoice);
      repo.findLineItem.mockResolvedValue(lineItem);
      await expect(service.deleteLineItem('u1', 'b1', 'i1', 'li1')).rejects.toThrow(BadRequestException);
      expect(repo.deleteLineItem).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    const dto = {
      issueDate: '2026-05-26', dueDate: '2026-06-09',
      to: 'client@example.com', contactId: 'c1',
      subject: 'Invoice INV-2026-001', body: '<p>Please find attached</p>',
    };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(issuedInvoice);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.send('u1', 'b1', 'missing', dto)).rejects.toThrow(NotFoundException);
      expect(mockLifecycle.send).not.toHaveBeenCalled();
    });

    it('delegates to lifecycle.send with userId, invoice, and dto', async () => {
      await service.send('u1', 'b1', 'i1', dto);
      expect(mockLifecycle.send).toHaveBeenCalledWith('u1', issuedInvoice, dto);
    });
  });

  describe('markSent', () => {
    const dto = { issueDate: '2026-05-26', dueDate: '2026-06-09' };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(issuedInvoice);
      repo.assignAndMarkSent.mockResolvedValue({ ...draftInvoice, status: 'SENT', invoiceNumber: 'INV-2026-001' });
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.markSent('u1', 'b1', 'missing', dto)).rejects.toThrow(NotFoundException);
      expect(mockLifecycle.markSent).not.toHaveBeenCalled();
    });

    it('delegates to lifecycle.markSent', async () => {
      await service.markSent('u1', 'b1', 'i1', dto);
      expect(mockLifecycle.markSent).toHaveBeenCalledWith(issuedInvoice, dto);
    });

    it('delegates to lifecycle.markSent with empty dto', async () => {
      await service.markSent('u1', 'b1', 'i1', {});
      expect(mockLifecycle.markSent).toHaveBeenCalledWith(issuedInvoice, {});
    });
  });

  describe('markPaid', () => {
    const sentInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'SENT', isDeposit: false, invoiceNumber: 'INV-2026-001' };
    const depositSentInvoice = { ...sentInvoice, isDeposit: true };
    const paidInvoice = { ...sentInvoice, status: 'PAID' };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(sentInvoice);
      repo.setBookingDepositReceivedAt.mockResolvedValue({});
      mockLifecycle.markPaid.mockResolvedValue(paidInvoice);
    });

    it('throws NotFoundException when invoice not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.markPaid('u1', 'b1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('delegates to lifecycle.markPaid', async () => {
      await service.markPaid('u1', 'b1', 'i1');
      expect(mockLifecycle.markPaid).toHaveBeenCalledWith(sentInvoice, expect.any(Function));
    });

    it('returns the paid invoice', async () => {
      const result = await service.markPaid('u1', 'b1', 'i1');
      expect(result).toBe(paidInvoice);
    });

    it('updates booking depositReceivedAt for deposit invoices via onCommit callback', async () => {
      repo.findOne.mockResolvedValue(depositSentInvoice);
      let capturedOnCommit: (() => Promise<void>) | undefined;
      mockLifecycle.markPaid.mockImplementation(async (_invoice: unknown, onCommit: typeof capturedOnCommit) => {
        capturedOnCommit = onCommit;
        return paidInvoice;
      });

      await service.markPaid('u1', 'b1', 'i1');
      await capturedOnCommit!();

      expect(repo.setBookingDepositReceivedAt).toHaveBeenCalledWith('b1');
    });

    it('does not update depositReceivedAt for balance invoices', async () => {
      let capturedOnCommit: (() => Promise<void>) | undefined;
      mockLifecycle.markPaid.mockImplementation(async (_invoice: unknown, onCommit: typeof capturedOnCommit) => {
        capturedOnCommit = onCommit;
        return paidInvoice;
      });

      await service.markPaid('u1', 'b1', 'i1');
      await capturedOnCommit!();

      expect(repo.setBookingDepositReceivedAt).not.toHaveBeenCalled();
    });
  });

  describe('voidInvoice', () => {
    const sentInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'SENT', isDeposit: true, invoiceNumber: 'INV-2026-001' };
    const voidedInvoice = { ...sentInvoice, status: 'VOID' };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(sentInvoice);
      mockLifecycle.voidInvoice.mockResolvedValue(voidedInvoice);
      repo.countActiveByType.mockResolvedValue(0);
    });

    it('throws BadRequestException for a DRAFT invoice', async () => {
      repo.findOne.mockResolvedValue({ ...sentInvoice, status: 'DRAFT', invoiceNumber: null });
      mockLifecycle.voidInvoice.mockRejectedValue(new BadRequestException('Draft invoices cannot be voided — delete them instead'));
      await expect(service.voidInvoice('u1', 'b1', 'i1')).rejects.toThrow(BadRequestException);
      expect(repo.countActiveByType).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an already-VOID invoice', async () => {
      repo.findOne.mockResolvedValue({ ...sentInvoice, status: 'VOID' });
      mockLifecycle.voidInvoice.mockRejectedValue(new BadRequestException('Invoice is already VOID'));
      await expect(service.voidInvoice('u1', 'b1', 'i1')).rejects.toThrow(BadRequestException);
    });

    it('delegates to lifecycle.voidInvoice', async () => {
      await service.voidInvoice('u1', 'b1', 'i1');
      expect(mockLifecycle.voidInvoice).toHaveBeenCalledWith(sentInvoice);
    });

    it('voids an ISSUED invoice', async () => {
      repo.findOne.mockResolvedValue({ ...sentInvoice, status: 'ISSUED' });
      await service.voidInvoice('u1', 'b1', 'i1');
      expect(mockLifecycle.voidInvoice).toHaveBeenCalledWith(expect.objectContaining({ status: 'ISSUED' }));
    });

    it('voids a PAID invoice', async () => {
      repo.findOne.mockResolvedValue({ ...sentInvoice, status: 'PAID' });
      await service.voidInvoice('u1', 'b1', 'i1');
      expect(mockLifecycle.voidInvoice).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID' }));
    });

    it('returns the voided invoice', async () => {
      const result = await service.voidInvoice('u1', 'b1', 'i1');
      expect(result).toBe(voidedInvoice);
    });

    it('resets the create_deposit_invoice checklist item when no active deposit invoices remain', async () => {
      repo.countActiveByType.mockResolvedValue(0);
      await service.voidInvoice('u1', 'b1', 'i1');
      expect(mockChecklistRepo.resetItemByKey).toHaveBeenCalledWith('b1', 'create_deposit_invoice');
    });

    it('resets the create_balance_invoice checklist item when no active balance invoices remain', async () => {
      repo.findOne.mockResolvedValue({ ...sentInvoice, isDeposit: false });
      repo.countActiveByType.mockResolvedValue(0);
      await service.voidInvoice('u1', 'b1', 'i1');
      expect(mockChecklistRepo.resetItemByKey).toHaveBeenCalledWith('b1', 'create_balance_invoice');
    });

    it('does not reset checklist item when other active invoices of the same type remain', async () => {
      repo.countActiveByType.mockResolvedValue(1);
      await service.voidInvoice('u1', 'b1', 'i1');
      expect(mockChecklistRepo.resetItemByKey).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when invoice does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.voidInvoice('u1', 'b1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
