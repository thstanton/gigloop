import { NotFoundException } from '@nestjs/common';
import { SeriesService } from './series.service';
import { SeriesRepository } from './series.repository';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };
}

const seriesWithMeta = {
  id: 's1',
  createdAt: new Date(),
  updatedAt: new Date(),
  label: 'Hotel X — May 2026',
  customerId: 'c1',
  customer: { id: 'c1', name: 'Hotel X', email: null },
  bookings: [{ id: 'b1' }, { id: 'b2' }],
  invoices: [{ id: 'inv1', status: 'SENT' }],
};

describe('SeriesService', () => {
  let service: SeriesService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new SeriesService(repo as unknown as SeriesRepository);
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([{ id: 's1', label: 'Test' }]);
      const result = await service.findAll('u1');
      expect(repo.findAll).toHaveBeenCalledWith('u1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns series with derived fields', async () => {
      repo.findOne.mockResolvedValue(seriesWithMeta);
      const result = await service.findOne('u1', 's1');
      expect(result.memberBookingCount).toBe(2);
      expect(result.invoiceStatus).toBe('SENT');
    });

    it('returns null invoiceStatus when all invoices are VOID', async () => {
      repo.findOne.mockResolvedValue({
        ...seriesWithMeta,
        invoices: [{ id: 'inv1', status: 'VOID' }],
      });
      const result = await service.findOne('u1', 's1');
      expect(result.invoiceStatus).toBeNull();
    });

    it('returns null invoiceStatus when series has no invoices', async () => {
      repo.findOne.mockResolvedValue({ ...seriesWithMeta, invoices: [] });
      const result = await service.findOne('u1', 's1');
      expect(result.invoiceStatus).toBeNull();
    });

    it('throws NotFoundException when series not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
