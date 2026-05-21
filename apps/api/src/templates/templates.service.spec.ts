import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesRepository } from './templates.repository';

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

const content = { type: 'doc', content: [] };
const customTemplate = { id: 't1', userId: 'u1', name: 'My Template', content, builtInType: null };
const builtInTemplate = { id: 't2', userId: 'u1', name: 'Contract', content, builtInType: 'contract' };

describe('TemplatesService', () => {
  let service: TemplatesService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new TemplatesService(repo as unknown as TemplatesRepository);
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([customTemplate]);
      const result = await service.findAll('u1');
      expect(repo.findAll).toHaveBeenCalledWith('u1');
      expect(result).toEqual([customTemplate]);
    });
  });

  describe('findOne', () => {
    it('returns the template when found', async () => {
      repo.findOne.mockResolvedValue(customTemplate);
      const result = await service.findOne('u1', 't1');
      expect(repo.findOne).toHaveBeenCalledWith('u1', 't1');
      expect(result).toBe(customTemplate);
    });

    it('throws NotFoundException when repository returns null', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('delegates to repository with userId and dto', async () => {
      const dto = { name: 'My Template', content };
      repo.create.mockResolvedValue(customTemplate);
      const result = await service.create('u1', dto);
      expect(repo.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(customTemplate);
    });
  });

  describe('update', () => {
    it('updates when template exists', async () => {
      repo.findOne.mockResolvedValue(customTemplate);
      const updated = { ...customTemplate, name: 'Renamed' };
      repo.update.mockResolvedValue(updated);
      const result = await service.update('u1', 't1', { name: 'Renamed' });
      expect(repo.update).toHaveBeenCalledWith('t1', { name: 'Renamed' });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException without calling update when template is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('u1', 'missing', { name: 'X' })).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a custom template', async () => {
      repo.findOne.mockResolvedValue(customTemplate);
      repo.delete.mockResolvedValue(customTemplate);
      await service.delete('u1', 't1');
      expect(repo.delete).toHaveBeenCalledWith('t1');
    });

    it('throws NotFoundException without calling delete when template is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.delete('u1', 'missing')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException without calling delete for a built-in template', async () => {
      repo.findOne.mockResolvedValue(builtInTemplate);
      await expect(service.delete('u1', 't2')).rejects.toThrow(ForbiddenException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
