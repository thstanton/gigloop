import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsRepository } from './contacts.repository';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  countBookings: jest.Mock;
  findCustomerBookingIds: jest.Mock;
  delete: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    countBookings: jest.fn(),
    findCustomerBookingIds: jest.fn().mockResolvedValue([]),
    delete: jest.fn(),
  };
}

const contact = { id: 'c1', name: 'Alice', userId: 'u1' };

describe('ContactsService', () => {
  let service: ContactsService;
  let repo: MockRepo;
  let evaluator: { evaluate: jest.Mock };

  beforeEach(() => {
    repo = makeRepo();
    evaluator = { evaluate: jest.fn().mockResolvedValue(undefined) };
    service = new ContactsService(
      repo as unknown as ContactsRepository,
      evaluator as unknown as ChecklistEvaluatorService,
    );
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([contact]);
      const result = await service.findAll('u1');
      expect(repo.findAll).toHaveBeenCalledWith('u1');
      expect(result).toEqual([contact]);
    });
  });

  describe('findOne', () => {
    it('returns the contact when found', async () => {
      repo.findOne.mockResolvedValue(contact);
      const result = await service.findOne('u1', 'c1');
      expect(repo.findOne).toHaveBeenCalledWith('u1', 'c1');
      expect(result).toBe(contact);
    });

    it('throws NotFoundException when repository returns null', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('delegates to repository with userId and dto', async () => {
      repo.create.mockResolvedValue(contact);
      const dto = { name: 'Alice' };
      const result = await service.create('u1', dto);
      expect(repo.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(contact);
    });
  });

  describe('update', () => {
    it('updates and returns result when contact is found', async () => {
      repo.findOne.mockResolvedValue(contact);
      const updated = { ...contact, name: 'Alicia' };
      repo.update.mockResolvedValue(updated);
      const result = await service.update('u1', 'c1', { name: 'Alicia' });
      expect(repo.update).toHaveBeenCalledWith('c1', { name: 'Alicia' });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException without calling update when contact is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('u1', 'missing', { name: 'X' })).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('clears travel time fields when an address field is included in the update', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.update.mockResolvedValue({ ...contact, city: 'London' });
      await service.update('u1', 'c1', { city: 'London' });
      expect(repo.update).toHaveBeenCalledWith('c1', {
        city: 'London',
        travelTimeMinutes: null,
        travelDistanceMetres: null,
        travelTimeCalculatedAt: null,
        travelMode: null,
      });
    });

    it('does not clear travel time fields when no address field is included in the update', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.update.mockResolvedValue({ ...contact, name: 'Bob' });
      await service.update('u1', 'c1', { name: 'Bob' });
      expect(repo.update).toHaveBeenCalledWith('c1', { name: 'Bob' });
    });

    it('re-evaluates the customer bookings checklists when the email changes (#618)', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.update.mockResolvedValue({ ...contact, email: 'a@b.com' });
      repo.findCustomerBookingIds.mockResolvedValue(['b1', 'b2']);
      await service.update('u1', 'c1', { email: 'a@b.com' });
      expect(repo.findCustomerBookingIds).toHaveBeenCalledWith('u1', 'c1');
      expect(evaluator.evaluate).toHaveBeenCalledWith('b1');
      expect(evaluator.evaluate).toHaveBeenCalledWith('b2');
    });

    it('does not re-evaluate when the update does not touch the email (#618)', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.update.mockResolvedValue({ ...contact, name: 'Bob' });
      await service.update('u1', 'c1', { name: 'Bob' });
      expect(repo.findCustomerBookingIds).not.toHaveBeenCalled();
      expect(evaluator.evaluate).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes contact when it exists and has no bookings', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.countBookings.mockResolvedValue(0);
      repo.delete.mockResolvedValue(contact);
      await service.delete('u1', 'c1');
      expect(repo.delete).toHaveBeenCalledWith('c1');
    });

    it('throws NotFoundException when contact is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.countBookings).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException with the required message when contact has bookings', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.countBookings.mockResolvedValue(3);
      await expect(service.delete('u1', 'c1')).rejects.toThrow(
        new ConflictException('Contact has associated bookings and cannot be deleted'),
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('scopes the booking count check to the correct userId and contactId', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.countBookings.mockResolvedValue(0);
      repo.delete.mockResolvedValue(contact);
      await service.delete('u1', 'c1');
      expect(repo.countBookings).toHaveBeenCalledWith('u1', 'c1');
    });
  });
});
