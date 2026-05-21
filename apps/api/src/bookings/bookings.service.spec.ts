import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { BookingsRepository } from './bookings.repository';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  cancel: jest.Mock;
  findSet: jest.Mock;
  addSet: jest.Mock;
  updateSet: jest.Mock;
  deleteSet: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    findSet: jest.fn(),
    addSet: jest.fn(),
    updateSet: jest.fn(),
    deleteSet: jest.fn(),
  };
}

const booking = { id: 'b1', userId: 'u1', status: BookingStatus.CONFIRMED };
const set = { id: 's1', bookingId: 'b1', userId: 'u1' };

describe('BookingsService', () => {
  let service: BookingsService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new BookingsService(repo as unknown as BookingsRepository);
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([booking]);
      const result = await service.findAll('u1');
      expect(repo.findAll).toHaveBeenCalledWith('u1', undefined);
      expect(result).toEqual([booking]);
    });

    it('passes a valid status filter through to the repository', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', 'CONFIRMED');
      expect(repo.findAll).toHaveBeenCalledWith('u1', 'CONFIRMED');
    });

    it('throws BadRequestException for an unrecognised status', () => {
      expect(() => service.findAll('u1', 'NONSENSE')).toThrow(BadRequestException);
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('accepts CANCELLED as a valid status', async () => {
      repo.findAll.mockResolvedValue([]);
      await expect(service.findAll('u1', 'CANCELLED')).resolves.not.toThrow();
    });
  });

  describe('findOne', () => {
    it('returns the booking with hasMusicFormConfig and hasMusicFormResponse flags', async () => {
      repo.findOne.mockResolvedValue({ ...booking, musicFormConfig: null, musicFormResponse: null });
      const result = await service.findOne('u1', 'b1');
      expect(repo.findOne).toHaveBeenCalledWith('u1', 'b1');
      expect(result).toMatchObject({ id: 'b1', hasMusicFormConfig: false, hasMusicFormResponse: false });
    });

    it('sets hasMusicFormConfig true when config exists', async () => {
      repo.findOne.mockResolvedValue({ ...booking, musicFormConfig: { id: 'mfc1' }, musicFormResponse: null });
      const result = await service.findOne('u1', 'b1');
      expect(result.hasMusicFormConfig).toBe(true);
      expect(result.hasMusicFormResponse).toBe(false);
    });

    it('throws NotFoundException when repository returns null', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('returns cancelled bookings', async () => {
      const cancelled = { ...booking, status: BookingStatus.CANCELLED };
      repo.findOne.mockResolvedValue(cancelled);
      const result = await service.findOne('u1', 'b1');
      expect(result.status).toBe(BookingStatus.CANCELLED);
    });
  });

  describe('create', () => {
    it('delegates to repository with userId and dto', async () => {
      repo.create.mockResolvedValue(booking);
      const dto = { eventType: 'WEDDING' as const, date: '2026-06-01', customerId: 'c1' };
      const result = await service.create('u1', dto);
      expect(repo.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(booking);
    });
  });

  describe('update', () => {
    it('updates and returns result when booking exists', async () => {
      repo.findOne.mockResolvedValue(booking);
      const updated = { ...booking, status: BookingStatus.INVOICED };
      repo.update.mockResolvedValue(updated);
      const result = await service.update('u1', 'b1', { status: BookingStatus.INVOICED });
      expect(repo.update).toHaveBeenCalledWith('b1', { status: BookingStatus.INVOICED });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException without calling update when booking is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('u1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('cancels the booking when it exists', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.cancel.mockResolvedValue({ ...booking, status: BookingStatus.CANCELLED });
      await service.delete('u1', 'b1');
      expect(repo.cancel).toHaveBeenCalledWith('b1');
    });

    it('throws NotFoundException without cancelling when booking is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.cancel).not.toHaveBeenCalled();
    });
  });

  describe('addSet', () => {
    it('adds a set when the booking exists', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.addSet.mockResolvedValue(set);
      const dto = { order: 1, duration: 60 };
      const result = await service.addSet('u1', 'b1', dto);
      expect(repo.addSet).toHaveBeenCalledWith('u1', 'b1', dto);
      expect(result).toBe(set);
    });

    it('throws NotFoundException without adding when booking is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.addSet('u1', 'missing', { order: 1, duration: 60 })).rejects.toThrow(NotFoundException);
      expect(repo.addSet).not.toHaveBeenCalled();
    });
  });

  describe('updateSet', () => {
    it('updates the set when booking and set both exist', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(set);
      const updated = { ...set, duration: 90 };
      repo.updateSet.mockResolvedValue(updated);
      const result = await service.updateSet('u1', 'b1', 's1', { duration: 90 });
      expect(repo.updateSet).toHaveBeenCalledWith('s1', { duration: 90 });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when the booking is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.updateSet('u1', 'missing', 's1', {})).rejects.toThrow(NotFoundException);
      expect(repo.updateSet).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the set is not found on the booking', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(null);
      await expect(service.updateSet('u1', 'b1', 'missing', {})).rejects.toThrow(NotFoundException);
      expect(repo.updateSet).not.toHaveBeenCalled();
    });

    it('scopes set lookup to the correct booking and user', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(set);
      repo.updateSet.mockResolvedValue(set);
      await service.updateSet('u1', 'b1', 's1', {});
      expect(repo.findSet).toHaveBeenCalledWith('u1', 'b1', 's1');
    });
  });

  describe('deleteSet', () => {
    it('deletes the set when booking and set both exist', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(set);
      repo.deleteSet.mockResolvedValue(set);
      await service.deleteSet('u1', 'b1', 's1');
      expect(repo.deleteSet).toHaveBeenCalledWith('s1');
    });

    it('throws NotFoundException when the booking is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deleteSet('u1', 'missing', 's1')).rejects.toThrow(NotFoundException);
      expect(repo.deleteSet).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the set is not found on the booking', async () => {
      repo.findOne.mockResolvedValue(booking);
      repo.findSet.mockResolvedValue(null);
      await expect(service.deleteSet('u1', 'b1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.deleteSet).not.toHaveBeenCalled();
    });
  });
});
