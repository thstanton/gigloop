import { ConflictException, NotFoundException } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PackagesRepository } from './packages.repository';
import { CreatePackageDto } from './dto/create-package.dto';

type MockRepo = {
  countByUserId: jest.Mock;
  findAll: jest.Mock;
  findOne: jest.Mock;
  createMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  countBookingsByPackageId: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    countByUserId: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countBookingsByPackageId: jest.fn(),
  };
}

const pkg = { id: 'p1', label: 'Wedding Ceremony', slots: [] };

describe('PackagesService', () => {
  let service: PackagesService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new PackagesService(repo as unknown as PackagesRepository);
  });

  describe('findAll', () => {
    it('seeds 7 defaults and returns them on first call', async () => {
      repo.countByUserId.mockResolvedValue(0);
      repo.createMany.mockResolvedValue([]);
      repo.findAll.mockResolvedValue([pkg]);

      const result = await service.findAll('u1');

      expect(repo.createMany).toHaveBeenCalledWith('u1', expect.arrayContaining([
        expect.objectContaining({ label: 'Wedding Ceremony' }),
      ]));
      expect(repo.createMany.mock.calls[0][1]).toHaveLength(7);
      expect(result).toEqual([pkg]);
    });

    it('skips seeding when packages already exist', async () => {
      repo.countByUserId.mockResolvedValue(7);
      repo.findAll.mockResolvedValue([pkg]);

      await service.findAll('u1');

      expect(repo.createMany).not.toHaveBeenCalled();
    });

    it('returns packages from repository', async () => {
      repo.countByUserId.mockResolvedValue(3);
      repo.findAll.mockResolvedValue([pkg]);

      const result = await service.findAll('u1');
      expect(result).toEqual([pkg]);
    });
  });

  describe('create', () => {
    it('delegates to repo.create', async () => {
      const dto = { label: 'Custom', icon: 'music', slots: [] };
      repo.create.mockResolvedValue({ ...pkg, ...dto });

      const result = await service.create('u1', dto as CreatePackageDto);

      expect(repo.create).toHaveBeenCalledWith('u1', dto);
      expect(result.label).toBe('Custom');
    });
  });

  describe('update', () => {
    it('throws 404 if package not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('u1', 'missing', {})).rejects.toThrow(NotFoundException);
    });

    it('delegates to repo.update when package exists', async () => {
      repo.findOne.mockResolvedValue(pkg);
      repo.update.mockResolvedValue({ ...pkg, label: 'Updated' });

      const result = await service.update('u1', 'p1', { label: 'Updated' });

      expect(repo.update).toHaveBeenCalledWith('u1', 'p1', { label: 'Updated' });
      expect(result.label).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('throws 404 if package not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws 409 if package has bookings', async () => {
      repo.findOne.mockResolvedValue(pkg);
      repo.countBookingsByPackageId.mockResolvedValue(2);

      await expect(service.delete('u1', 'p1')).rejects.toThrow(ConflictException);
    });

    it('deletes when no bookings reference the package', async () => {
      repo.findOne.mockResolvedValue(pkg);
      repo.countBookingsByPackageId.mockResolvedValue(0);
      repo.delete.mockResolvedValue(pkg);

      await service.delete('u1', 'p1');

      expect(repo.delete).toHaveBeenCalledWith('p1');
    });
  });
});
