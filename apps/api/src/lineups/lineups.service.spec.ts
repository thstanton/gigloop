import { NotFoundException } from '@nestjs/common';
import { LineupsService } from './lineups.service';
import { LineupsRepository } from './lineups.repository';
import { CreateLineupDto } from './dto/create-lineup.dto';

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

const lineup = { id: 'l1', label: 'My five-piece', slots: [] };

describe('LineupsService', () => {
  let service: LineupsService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new LineupsService(repo as unknown as LineupsRepository);
  });

  describe('findAll', () => {
    it('returns lineups straight from the repository', async () => {
      repo.findAll.mockResolvedValue([lineup]);

      const result = await service.findAll('u1');

      expect(result).toEqual([lineup]);
    });
  });

  describe('findOne', () => {
    it('delegates to repo.findOne (used by PackagesService for cross-tenant ownership checks)', async () => {
      repo.findOne.mockResolvedValue(lineup);

      const result = await service.findOne('u1', 'l1');

      expect(repo.findOne).toHaveBeenCalledWith('u1', 'l1');
      expect(result).toEqual(lineup);
    });
  });

  describe('create', () => {
    it('delegates to repo.create', async () => {
      const dto = { label: 'Custom', slots: [] };
      repo.create.mockResolvedValue({ ...lineup, ...dto });

      const result = await service.create('u1', dto as CreateLineupDto);

      expect(repo.create).toHaveBeenCalledWith('u1', dto);
      expect(result.label).toBe('Custom');
    });
  });

  describe('update', () => {
    it('throws 404 if lineup not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('u1', 'missing', {})).rejects.toThrow(NotFoundException);
    });

    it('delegates to repo.update when lineup exists', async () => {
      repo.findOne.mockResolvedValue(lineup);
      repo.update.mockResolvedValue({ ...lineup, label: 'Updated' });

      const result = await service.update('u1', 'l1', { label: 'Updated' });

      expect(repo.update).toHaveBeenCalledWith('u1', 'l1', { label: 'Updated' });
      expect(result.label).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('throws 404 if lineup not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('deletes the lineup', async () => {
      repo.findOne.mockResolvedValue(lineup);
      repo.delete.mockResolvedValue(lineup);

      await service.delete('u1', 'l1');

      expect(repo.delete).toHaveBeenCalledWith('l1');
    });
  });
});
