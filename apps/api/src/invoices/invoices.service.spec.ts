import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { CommunicationsService } from '../communications/communications.service';

jest.mock('../documents/documents.service', () => ({
  DocumentsService: jest.fn().mockImplementation(() => ({
    generateAndStoreInvoicePdf: jest.fn(),
    generatePreviewPdf: jest.fn(),
  })),
}));

type MockRepo = {
  findBookingCustomerId: jest.Mock;
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  assignAndMarkSent: jest.Mock;
  markPaid: jest.Mock;
  voidInvoice: jest.Mock;
  countActiveByType: jest.Mock;
  findLineItem: jest.Mock;
  addLineItem: jest.Mock;
  updateLineItem: jest.Mock;
  deleteLineItem: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findBookingCustomerId: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    assignAndMarkSent: jest.fn(),
    markPaid: jest.fn(),
    voidInvoice: jest.fn(),
    countActiveByType: jest.fn(),
    findLineItem: jest.fn(),
    addLineItem: jest.fn(),
    updateLineItem: jest.fn(),
    deleteLineItem: jest.fn(),
  };
}

const mockComms = { sendEmail: jest.fn() } as unknown as CommunicationsService;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDocuments = { generateAndStoreInvoicePdf: jest.fn(), generatePreviewPdf: jest.fn() } as any;

const invoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'DRAFT' };
const lineItem = { id: 'li1', invoiceId: 'i1', userId: 'u1' };

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repo: MockRepo;

  let mockChecklistRepo: { resetItemByKey: jest.Mock };

  beforeEach(() => {
    repo = makeRepo();
    const mockEvaluator = { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService;
    mockChecklistRepo = { resetItemByKey: jest.fn().mockResolvedValue({ count: 0 }) };
    service = new InvoicesService(
      repo as unknown as InvoicesRepository,
      mockComms,
      mockDocuments,
      mockEvaluator,
      mockChecklistRepo as unknown as import('../checklist/checklist.repository').ChecklistRepository,
    );
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([invoice]);
      const result = await service.findAll('u1', 'b1');
      expect(repo.findAll).toHaveBeenCalledWith('u1', 'b1');
      expect(result).toEqual([invoice]);
    });
  });

  describe('findOne', () => {
    it('returns invoice when found', async () => {
      repo.findOne.mockResolvedValue(invoice);
      const result = await service.findOne('u1', 'b1', 'i1');
      expect(result).toBe(invoice);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'b1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('defaults billToContactId to the booking customerId when not provided', async () => {
      repo.findBookingCustomerId.mockResolvedValue('c1');
      repo.create.mockResolvedValue(invoice);
      await service.create('u1', 'b1', {});
      expect(repo.create).toHaveBeenCalledWith('u1', 'b1', 'c1', {});
    });

    it('uses the provided billToContactId instead of the booking customer', async () => {
      repo.findBookingCustomerId.mockResolvedValue('c1');
      repo.create.mockResolvedValue(invoice);
      await service.create('u1', 'b1', { billToContactId: 'c2' });
      expect(repo.create).toHaveBeenCalledWith('u1', 'b1', 'c2', { billToContactId: 'c2' });
    });

    it('throws NotFoundException when booking is not found', async () => {
      repo.findBookingCustomerId.mockResolvedValue(null);
      await expect(service.create('u1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates when invoice exists', async () => {
      repo.findOne.mockResolvedValue(invoice);
      const updated = { ...invoice, status: 'SENT' };
      repo.update.mockResolvedValue(updated);
      const result = await service.update('u1', 'b1', 'i1', { status: 'SENT' as const });
      expect(repo.update).toHaveBeenCalledWith('i1', { status: 'SENT' });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException without calling update when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('u1', 'b1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes when invoice exists', async () => {
      repo.findOne.mockResolvedValue(invoice);
      repo.delete.mockResolvedValue(invoice);
      await service.delete('u1', 'b1', 'i1');
      expect(repo.delete).toHaveBeenCalledWith('i1');
    });

    it('throws NotFoundException without deleting when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete('u1', 'b1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('addLineItem', () => {
    it('adds line item when invoice exists', async () => {
      repo.findOne.mockResolvedValue(invoice);
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
  });

  describe('updateLineItem', () => {
    it('updates line item when invoice and item both exist', async () => {
      repo.findOne.mockResolvedValue(invoice);
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
      repo.findOne.mockResolvedValue(invoice);
      repo.findLineItem.mockResolvedValue(null);
      await expect(service.updateLineItem('u1', 'b1', 'i1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.updateLineItem).not.toHaveBeenCalled();
    });

    it('scopes line item lookup to the correct invoice and user', async () => {
      repo.findOne.mockResolvedValue(invoice);
      repo.findLineItem.mockResolvedValue(lineItem);
      repo.updateLineItem.mockResolvedValue(lineItem);
      await service.updateLineItem('u1', 'b1', 'i1', 'li1', {});
      expect(repo.findLineItem).toHaveBeenCalledWith('u1', 'i1', 'li1');
    });
  });

  describe('deleteLineItem', () => {
    it('deletes line item when invoice and item both exist', async () => {
      repo.findOne.mockResolvedValue(invoice);
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
      repo.findOne.mockResolvedValue(invoice);
      repo.findLineItem.mockResolvedValue(null);
      await expect(service.deleteLineItem('u1', 'b1', 'i1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.deleteLineItem).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    const sentInvoice = { ...invoice, status: 'SENT', invoiceNumber: 'INV-2026-001', issueDate: new Date('2026-05-26'), dueDate: new Date('2026-06-09') };
    const pdfBuffer = Buffer.from('pdf');
    const dto = {
      issueDate: '2026-05-26',
      dueDate: '2026-06-09',
      to: 'client@example.com',
      contactId: 'c1',
      subject: 'Invoice INV-2026-001',
      body: '<p>Please find attached</p>',
    };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(invoice);
      repo.assignAndMarkSent.mockResolvedValue(sentInvoice);
      mockDocuments.generateAndStoreInvoicePdf.mockResolvedValue({ buffer: pdfBuffer });
      (mockComms.sendEmail as jest.Mock).mockResolvedValue(undefined);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.send('u1', 'b1', 'missing', dto)).rejects.toThrow(NotFoundException);
      expect(repo.assignAndMarkSent).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      repo.findOne.mockResolvedValue({ ...invoice, status: 'SENT' });
      await expect(service.send('u1', 'b1', 'i1', dto)).rejects.toThrow(BadRequestException);
      expect(repo.assignAndMarkSent).not.toHaveBeenCalled();
    });

    it('calls assignAndMarkSent with parsed issueDate and dueDate', async () => {
      await service.send('u1', 'b1', 'i1', dto);
      expect(repo.assignAndMarkSent).toHaveBeenCalledWith('u1', 'i1', new Date('2026-05-26'), new Date('2026-06-09'));
    });

    it('calls assignAndMarkSent with null dueDate when not provided', async () => {
      await service.send('u1', 'b1', 'i1', { ...dto, dueDate: undefined });
      expect(repo.assignAndMarkSent).toHaveBeenCalledWith('u1', 'i1', new Date('2026-05-26'), null);
    });

    it('calls generateAndStoreInvoicePdf with the sentInvoice to avoid a redundant DB fetch', async () => {
      await service.send('u1', 'b1', 'i1', dto);
      expect(mockDocuments.generateAndStoreInvoicePdf).toHaveBeenCalledWith('u1', 'b1', sentInvoice.id, sentInvoice);
    });

    it('sends email with PDF attachment named after the invoice number', async () => {
      await service.send('u1', 'b1', 'i1', dto);
      expect(mockComms.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        attachments: [{ filename: 'INV-2026-001.pdf', content: pdfBuffer }],
        to: dto.to,
        subject: dto.subject,
        body: dto.body,
      }));
    });
  });

  describe('markSent', () => {
    const sentInvoice = { ...invoice, status: 'SENT', invoiceNumber: 'INV-2026-001' };
    const dto = { issueDate: '2026-05-26', dueDate: '2026-06-09' };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(invoice);
      repo.assignAndMarkSent.mockResolvedValue(sentInvoice);
    });

    it('throws NotFoundException when invoice is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.markSent('u1', 'b1', 'missing', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when invoice is not DRAFT', async () => {
      repo.findOne.mockResolvedValue({ ...invoice, status: 'SENT' });
      await expect(service.markSent('u1', 'b1', 'i1', dto)).rejects.toThrow(BadRequestException);
      expect(repo.assignAndMarkSent).not.toHaveBeenCalled();
    });

    it('calls assignAndMarkSent with parsed issueDate and dueDate', async () => {
      await service.markSent('u1', 'b1', 'i1', dto);
      expect(repo.assignAndMarkSent).toHaveBeenCalledWith('u1', 'i1', new Date('2026-05-26'), new Date('2026-06-09'));
    });

    it('calls assignAndMarkSent with null dueDate when not provided', async () => {
      await service.markSent('u1', 'b1', 'i1', { issueDate: '2026-05-26' });
      expect(repo.assignAndMarkSent).toHaveBeenCalledWith('u1', 'i1', new Date('2026-05-26'), null);
    });

    it('returns the updated invoice', async () => {
      const result = await service.markSent('u1', 'b1', 'i1', dto);
      expect(result).toBe(sentInvoice);
    });
  });

  describe('markPaid', () => {
    const sentInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'SENT', isDeposit: false };
    const paidInvoice = { ...sentInvoice, status: 'PAID' };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(sentInvoice);
      repo.markPaid.mockResolvedValue(paidInvoice);
    });

    it('throws BadRequestException when invoice is not SENT', async () => {
      repo.findOne.mockResolvedValue({ ...sentInvoice, status: 'DRAFT' });
      await expect(service.markPaid('u1', 'b1', 'i1')).rejects.toThrow(BadRequestException);
      expect(repo.markPaid).not.toHaveBeenCalled();
    });

    it('delegates to repository markPaid', async () => {
      await service.markPaid('u1', 'b1', 'i1');
      expect(repo.markPaid).toHaveBeenCalledWith('u1', 'b1', 'i1');
    });

    it('returns the paid invoice', async () => {
      const result = await service.markPaid('u1', 'b1', 'i1');
      expect(result).toBe(paidInvoice);
    });
  });

  describe('voidInvoice', () => {
    const sentInvoice = { id: 'i1', bookingId: 'b1', userId: 'u1', status: 'SENT', isDeposit: true };
    const voidedInvoice = { ...sentInvoice, status: 'VOID' };

    beforeEach(() => {
      repo.findOne.mockResolvedValue(sentInvoice);
      repo.voidInvoice.mockResolvedValue(voidedInvoice);
      repo.countActiveByType.mockResolvedValue(0);
    });

    it('voids a SENT invoice', async () => {
      const result = await service.voidInvoice('u1', 'b1', 'i1');
      expect(repo.voidInvoice).toHaveBeenCalledWith('i1');
      expect(result).toBe(voidedInvoice);
    });

    it('voids a PAID invoice', async () => {
      repo.findOne.mockResolvedValue({ ...sentInvoice, status: 'PAID' });
      await service.voidInvoice('u1', 'b1', 'i1');
      expect(repo.voidInvoice).toHaveBeenCalledWith('i1');
    });

    it('throws BadRequestException for a DRAFT invoice', async () => {
      repo.findOne.mockResolvedValue({ ...sentInvoice, status: 'DRAFT' });
      await expect(service.voidInvoice('u1', 'b1', 'i1')).rejects.toThrow(BadRequestException);
      expect(repo.voidInvoice).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an already-VOID invoice', async () => {
      repo.findOne.mockResolvedValue({ ...sentInvoice, status: 'VOID' });
      await expect(service.voidInvoice('u1', 'b1', 'i1')).rejects.toThrow(BadRequestException);
      expect(repo.voidInvoice).not.toHaveBeenCalled();
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
