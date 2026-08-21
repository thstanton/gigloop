import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsRepository } from './contacts.repository';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  countOwned: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  countDeletionBlockers: jest.Mock;
  findCustomerBookingIds: jest.Mock;
  delete: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    countOwned: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    countDeletionBlockers: jest.fn(),
    findCustomerBookingIds: jest.fn().mockResolvedValue([]),
    delete: jest.fn(),
  };
}

const contact = { id: 'c1', name: 'Alice', userId: 'u1', _count: { bandMemberships: 0 } };

describe('ContactsService', () => {
  let service: ContactsService;
  let repo: MockRepo;
  let evaluator: { onBookingChanged: jest.Mock };

  beforeEach(() => {
    repo = makeRepo();
    evaluator = { onBookingChanged: jest.fn().mockResolvedValue(undefined) };
    service = new ContactsService(
      repo as unknown as ContactsRepository,
      evaluator as unknown as ChecklistReevaluator,
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

  describe('assertOwned', () => {
    it('passes silently when every id is owned', async () => {
      repo.countOwned.mockResolvedValue(2);
      await expect(service.assertOwned('u1', ['c1', 'c2'])).resolves.toBeUndefined();
      expect(repo.countOwned).toHaveBeenCalledWith('u1', ['c1', 'c2']);
    });

    it('throws NotFound when at least one id is not owned', async () => {
      repo.countOwned.mockResolvedValue(1); // only one of two owned
      await expect(service.assertOwned('u1', ['c1', 'foreign'])).rejects.toThrow(NotFoundException);
    });

    it('skips nullish ids and does not query when nothing remains', async () => {
      await expect(service.assertOwned('u1', [null, undefined])).resolves.toBeUndefined();
      expect(repo.countOwned).not.toHaveBeenCalled();
    });

    it('de-duplicates ids so a repeated FK counts once', async () => {
      repo.countOwned.mockResolvedValue(1);
      await expect(service.assertOwned('u1', ['c1', 'c1', null])).resolves.toBeUndefined();
      expect(repo.countOwned).toHaveBeenCalledWith('u1', ['c1']);
    });
  });

  describe('findOne', () => {
    it('returns the contact with the roster count flattened out of _count', async () => {
      repo.findOne.mockResolvedValue(contact);
      const result = await service.findOne('u1', 'c1');
      expect(repo.findOne).toHaveBeenCalledWith('u1', 'c1');
      expect(result).toEqual({ id: 'c1', name: 'Alice', userId: 'u1', bandMemberCount: 0 });
    });

    it('surfaces a non-zero band roster count (#886)', async () => {
      repo.findOne.mockResolvedValue({ ...contact, _count: { bandMemberships: 2 } });
      const result = await service.findOne('u1', 'c1');
      expect(result.bandMemberCount).toBe(2);
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
      expect(evaluator.onBookingChanged).toHaveBeenCalledWith('b1');
      expect(evaluator.onBookingChanged).toHaveBeenCalledWith('b2');
    });

    it('does not re-evaluate when the update does not touch the email (#618)', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.update.mockResolvedValue({ ...contact, name: 'Bob' });
      await service.update('u1', 'c1', { name: 'Bob' });
      expect(repo.findCustomerBookingIds).not.toHaveBeenCalled();
      expect(evaluator.onBookingChanged).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes contact when it exists and has no bookings or roster rows', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.countDeletionBlockers.mockResolvedValue({ bookingCount: 0, bandRosterCount: 0 });
      repo.delete.mockResolvedValue(contact);
      await service.delete('u1', 'c1');
      expect(repo.delete).toHaveBeenCalledWith('c1');
    });

    it('throws NotFoundException when contact is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.countDeletionBlockers).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException naming the booking count when only bookings block (booking-only)', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.countDeletionBlockers.mockResolvedValue({ bookingCount: 3, bandRosterCount: 0 });
      await expect(service.delete('u1', 'c1')).rejects.toThrow(
        new ConflictException('Contact has 3 bookings and cannot be deleted'),
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException naming the roster when only a roster row blocks (roster-only, #886)', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.countDeletionBlockers.mockResolvedValue({ bookingCount: 0, bandRosterCount: 1 });
      await expect(service.delete('u1', 'c1')).rejects.toThrow(
        new ConflictException('Contact is on the band roster for 1 booking and cannot be deleted'),
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException naming both when bookings and a roster row block (both, #886)', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.countDeletionBlockers.mockResolvedValue({ bookingCount: 1, bandRosterCount: 2 });
      await expect(service.delete('u1', 'c1')).rejects.toThrow(
        new ConflictException(
          'Contact has 1 booking and is on the band roster for 2 bookings, and cannot be deleted',
        ),
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('scopes the deletion-blocker check to the correct userId and contactId', async () => {
      repo.findOne.mockResolvedValue(contact);
      repo.countDeletionBlockers.mockResolvedValue({ bookingCount: 0, bandRosterCount: 0 });
      repo.delete.mockResolvedValue(contact);
      await service.delete('u1', 'c1');
      expect(repo.countDeletionBlockers).toHaveBeenCalledWith('u1', 'c1');
    });
  });
});
