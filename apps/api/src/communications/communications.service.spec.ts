import { NotFoundException } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsRepository } from './communications.repository';
import { MailService } from '../mail/mail.service';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  findBookingById: jest.Mock;
  create: jest.Mock;
  createPending: jest.Mock;
  markSent: jest.Mock;
  markFailed: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBookingById: jest.fn(),
    create: jest.fn(),
    createPending: jest.fn(),
    markSent: jest.fn(),
    markFailed: jest.fn(),
  };
}

const mockMail = { send: jest.fn() } as unknown as MailService;

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
    service = new CommunicationsService(repo as unknown as CommunicationsRepository, mockMail);
    (mockMail.send as jest.Mock).mockReset().mockResolvedValue(undefined);
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

  describe('sendEmail', () => {
    const options = {
      userId: 'u1',
      bookingId: 'b1',
      contactId: 'ct1',
      to: 'jane@example.com',
      subject: 'Your invoice',
      body: '<p>Please find attached</p>',
    };

    beforeEach(() => {
      repo.createPending.mockResolvedValue({ id: 'comm1' });
      repo.markSent.mockResolvedValue({});
      repo.markFailed.mockResolvedValue({});
    });

    it('creates a PENDING record before sending', async () => {
      await service.sendEmail(options);
      expect(repo.createPending).toHaveBeenCalledWith(
        'u1', 'b1', 'ct1', 'Your invoice', '<p>Please find attached</p>', undefined,
      );
    });

    it('calls mail.send with transport options only', async () => {
      await service.sendEmail(options);
      expect(mockMail.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'jane@example.com', subject: 'Your invoice' }),
      );
    });

    it('marks communication SENT on success', async () => {
      await service.sendEmail(options);
      expect(repo.markSent).toHaveBeenCalledWith('comm1');
    });

    it('marks communication FAILED and rethrows when mail.send throws', async () => {
      (mockMail.send as jest.Mock).mockRejectedValueOnce(new Error('Transport error'));
      await expect(service.sendEmail(options)).rejects.toThrow('Transport error');
      expect(repo.markFailed).toHaveBeenCalledWith('comm1');
    });

    it('passes templateId to createPending when provided', async () => {
      await service.sendEmail({ ...options, templateId: 'tmpl1' });
      expect(repo.createPending).toHaveBeenCalledWith(
        'u1', 'b1', 'ct1', 'Your invoice', '<p>Please find attached</p>', 'tmpl1',
      );
    });
  });
});
