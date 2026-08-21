import { NotFoundException } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PackagesRepository } from './packages.repository';
import { LineupsService } from '../lineups/lineups.service';
import { CreatePackageDto } from './dto/create-package.dto';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

const pkg = { id: 'p1', label: 'Wedding Ceremony', slots: [] };

describe('PackagesService', () => {
  let service: PackagesService;
  let repo: MockRepo;
  let lineups: { findOne: jest.Mock };

  beforeEach(() => {
    repo = makeRepo();
    lineups = { findOne: jest.fn() };
    service = new PackagesService(repo as unknown as PackagesRepository, lineups as unknown as LineupsService);
  });

  describe('findAll', () => {
    it('returns packages straight from the repository (#663 — no auto-seed)', async () => {
      repo.findAll.mockResolvedValue([pkg]);

      const result = await service.findAll('u1');

      expect(result).toEqual([pkg]);
    });

    it('returns an empty library for a new user (nothing seeded)', async () => {
      repo.findAll.mockResolvedValue([]);

      const result = await service.findAll('u1');

      expect(result).toEqual([]);
    });
  });

  describe('getCatalogue', () => {
    it('returns the 7 system-default starters without touching the repository', () => {
      const catalogue = service.getCatalogue();

      expect(catalogue).toHaveLength(7);
      expect(catalogue).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'wedding-ceremony', label: 'Wedding Ceremony' })]),
      );
      // Purely in-memory — no persistence, and category normalises undefined → null.
      expect(repo.findAll).not.toHaveBeenCalled();
      const background = catalogue.find((c) => c.label === 'Background Music');
      expect(background?.category).toBeNull();
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

    it('skips the lineup ownership check when no defaultLineupTemplateId is given', async () => {
      const dto = { label: 'Custom', icon: 'music', slots: [] };
      repo.create.mockResolvedValue({ ...pkg, ...dto });

      await service.create('u1', dto as CreatePackageDto);

      expect(lineups.findOne).not.toHaveBeenCalled();
    });

    it('throws 404 when defaultLineupTemplateId does not belong to this user (#879, ADR-0061)', async () => {
      lineups.findOne.mockResolvedValue(null);
      const dto = { label: 'Custom', icon: 'music', defaultLineupTemplateId: 'other-tenants-lineup' };

      await expect(service.create('u1', dto as CreatePackageDto)).rejects.toThrow(NotFoundException);
      expect(lineups.findOne).toHaveBeenCalledWith('u1', 'other-tenants-lineup');
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates once the defaultLineupTemplateId is proven to belong to this user', async () => {
      lineups.findOne.mockResolvedValue({ id: 'l1' });
      const dto = { label: 'Custom', icon: 'music', defaultLineupTemplateId: 'l1' };
      repo.create.mockResolvedValue({ ...pkg, ...dto });

      const result = await service.create('u1', dto as CreatePackageDto);

      expect(repo.create).toHaveBeenCalledWith('u1', dto);
      expect(result.defaultLineupTemplateId).toBe('l1');
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

    it('clearing defaultLineupTemplateId (null) never touches the ownership check', async () => {
      repo.findOne.mockResolvedValue(pkg);
      repo.update.mockResolvedValue({ ...pkg, defaultLineupTemplateId: null });

      await service.update('u1', 'p1', { defaultLineupTemplateId: null });

      expect(lineups.findOne).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith('u1', 'p1', { defaultLineupTemplateId: null });
    });

    it('throws 404 when the update tries to set another tenant\'s lineup', async () => {
      repo.findOne.mockResolvedValue(pkg);
      lineups.findOne.mockResolvedValue(null);

      await expect(
        service.update('u1', 'p1', { defaultLineupTemplateId: 'other-tenants-lineup' }),
      ).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('throws 404 if package not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('deletes the template (provenance severed — no booking-count check)', async () => {
      repo.findOne.mockResolvedValue(pkg);
      repo.delete.mockResolvedValue(pkg);

      await service.delete('u1', 'p1');

      expect(repo.delete).toHaveBeenCalledWith('p1');
    });
  });
});
