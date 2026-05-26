import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SongsService } from './songs.service';
import { SongsRepository } from './songs.repository';

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

const song = { id: 's1', userId: 'u1', title: 'Clair de Lune', genre: 'CLASSICAL' };

describe('SongsService', () => {
  let service: SongsService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new SongsService(repo as unknown as SongsRepository);
  });

  describe('findAll', () => {
    it('delegates to repository with no filters', async () => {
      repo.findAll.mockResolvedValue([song]);
      await service.findAll('u1');
      expect(repo.findAll).toHaveBeenCalledWith('u1', undefined, undefined);
    });

    it('passes a valid genre filter through to the repository', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', 'JAZZ');
      expect(repo.findAll).toHaveBeenCalledWith('u1', 'JAZZ', undefined);
    });

    it('parses active=true string to boolean true', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', undefined, 'true');
      expect(repo.findAll).toHaveBeenCalledWith('u1', undefined, true);
    });

    it('parses active=false string to boolean false', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.findAll('u1', undefined, 'false');
      expect(repo.findAll).toHaveBeenCalledWith('u1', undefined, false);
    });

    it('throws BadRequestException for an invalid genre', () => {
      expect(() => service.findAll('u1', 'OPERA')).toThrow(BadRequestException);
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an invalid active value', () => {
      expect(() => service.findAll('u1', undefined, 'yes')).toThrow(BadRequestException);
      expect(repo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the song when found', async () => {
      repo.findOne.mockResolvedValue(song);
      const result = await service.findOne('u1', 's1');
      expect(repo.findOne).toHaveBeenCalledWith('u1', 's1');
      expect(result).toBe(song);
    });

    it('throws NotFoundException when repository returns null', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('delegates to repository with userId and dto', async () => {
      repo.create.mockResolvedValue(song);
      const dto = { title: 'Clair de Lune', genre: 'CLASSICAL' };
      const result = await service.create('u1', dto);
      expect(repo.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(song);
    });
  });

  describe('update', () => {
    it('updates when song exists', async () => {
      repo.findOne.mockResolvedValue(song);
      const updated = { ...song, active: false };
      repo.update.mockResolvedValue(updated);
      const result = await service.update('u1', 's1', { active: false });
      expect(repo.update).toHaveBeenCalledWith('s1', { active: false });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException without calling update when song is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('u1', 'missing', { active: false })).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes when song exists', async () => {
      repo.findOne.mockResolvedValue(song);
      repo.delete.mockResolvedValue(song);
      await service.delete('u1', 's1');
      expect(repo.delete).toHaveBeenCalledWith('s1');
    });

    it('throws NotFoundException without calling delete when song is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
