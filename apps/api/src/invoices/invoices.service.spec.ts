import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';

type MockRepo = {
  findBookingCustomerId: jest.Mock;
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
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
    findLineItem: jest.fn(),
    addLineItem: jest.fn(),
    updateLineItem: jest.fn(),
    deleteLineItem: jest.fn(),
  };
}

const invoice = { id: 'i1', bookingId: 'b1', userId: 'u1' };
const lineItem = { id: 'li1', invoiceId: 'i1', userId: 'u1' };

describe('InvoicesService', () => {
  let service: InvoicesService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new InvoicesService(repo as unknown as InvoicesRepository);
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
});
