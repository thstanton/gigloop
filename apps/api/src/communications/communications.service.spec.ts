import { NotFoundException } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsRepository } from './communications.repository';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  findBookingById: jest.Mock;
  create: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBookingById: jest.fn(),
    create: jest.fn(),
  };
}

const communication = {
  id: 'c1',
  userId: 'u1',
  bookingId: 'b1',
  contactId: 'ct1',
  subject: 'Your booking confirmation',
  body: '<p>Hello</p>',
  direction: 'OUTBOUND',
  channel: 'EMAIL',
  sentAt: new Date(),
  templateId: null,
  contact: { id: 'ct1', name: 'Jane Doe' },
  template: null,
};

const booking = { id: 'b1' };

describe('CommunicationsService', () => {
  let service: CommunicationsService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new CommunicationsService(repo as unknown as CommunicationsRepository);
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([communication]);
      const result = await service.findAll('u1', 'b1');
      expect(repo.findAll).toHaveBeenCalledWith('u1', 'b1');
      expect(result).toEqual([communication]);
    });
  });

  describe('findOne', () => {
    it('returns the communication when found', async () => {
      repo.findOne.mockResolvedValue(communication);
      const result = await service.findOne('u1', 'b1', 'c1');
      expect(repo.findOne).toHaveBeenCalledWith('u1', 'b1', 'c1');
      expect(result).toBe(communication);
    });

    it('throws NotFoundException when repository returns null', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'b1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      contactId: 'ct1',
      subject: 'Your booking confirmation',
      body: '<p>Hello</p>',
    };

    it('creates when booking exists', async () => {
      repo.findBookingById.mockResolvedValue(booking);
      repo.create.mockResolvedValue(communication);
      const result = await service.create('u1', 'b1', dto);
      expect(repo.findBookingById).toHaveBeenCalledWith('u1', 'b1');
      expect(repo.create).toHaveBeenCalledWith('u1', 'b1', dto);
      expect(result).toBe(communication);
    });

    it('throws NotFoundException without calling create when booking is not found', async () => {
      repo.findBookingById.mockResolvedValue(null);
      await expect(service.create('u1', 'missing', dto)).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });
});
