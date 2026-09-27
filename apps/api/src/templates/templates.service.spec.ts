import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesRepository } from './templates.repository';
import { ALL_BUILT_IN_TYPES, BUILT_IN_TEMPLATE_META, getDefaultContent } from './default-templates';

type MockRepo = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  seedBuiltIns: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    seedBuiltIns: jest.fn(),
  };
}

const content = { type: 'doc', content: [] };
const customTemplate = { id: 't1', userId: 'u1', name: 'My Template', content, builtInType: null };
const builtInTemplate = { id: 't2', userId: 'u1', name: 'Quote', content, builtInType: 'quote' };
// A full set of seeded built-in templates (one per built-in type)
const seededTemplates = ALL_BUILT_IN_TYPES.map((type, i) => ({
  id: `t${i + 10}`, userId: 'u1', name: type, content, builtInType: type,
}));

describe('TemplatesService', () => {
  let service: TemplatesService;
  let repo: MockRepo;
  let originalBandFlag: string | undefined;

  beforeEach(() => {
    originalBandFlag = process.env.FEATURE_BAND_MEMBERS;
    process.env.FEATURE_BAND_MEMBERS = 'true';
    repo = makeRepo();
    service = new TemplatesService(repo as unknown as TemplatesRepository);
  });

  afterEach(() => {
    if (originalBandFlag === undefined) delete process.env.FEATURE_BAND_MEMBERS;
    else process.env.FEATURE_BAND_MEMBERS = originalBandFlag;
  });

  describe('findAll', () => {
    it('returns templates when all built-ins already exist', async () => {
      repo.findAll.mockResolvedValue(seededTemplates);
      const result = await service.findAll('u1');
      expect(repo.seedBuiltIns).not.toHaveBeenCalled();
      expect(result).toEqual(seededTemplates);
    });

    // #846's "no migration" premise: a new built-in type reaches an existing user because
    // findAll seeds whatever is absent, and only what is absent.
    it('seeds only the built-ins the user is missing', async () => {
      const withoutSeriesCover = seededTemplates.filter((t) => t.builtInType !== 'series_invoice_cover');
      repo.findAll
        .mockResolvedValueOnce(withoutSeriesCover)
        .mockResolvedValueOnce(seededTemplates);
      repo.seedBuiltIns.mockResolvedValue(undefined);
      const result = await service.findAll('u1');
      expect(repo.seedBuiltIns).toHaveBeenCalledWith('u1', ['series_invoice_cover']);
      expect(result).toEqual(seededTemplates);
    });

    it('seeds missing built-ins and returns refreshed list', async () => {
      repo.findAll
        .mockResolvedValueOnce([]) // first call: nothing seeded yet
        .mockResolvedValueOnce(seededTemplates); // after seeding
      repo.seedBuiltIns.mockResolvedValue(undefined);
      const result = await service.findAll('u1');
      expect(repo.seedBuiltIns).toHaveBeenCalledWith('u1', ALL_BUILT_IN_TYPES);
      expect(result).toEqual(seededTemplates);
    });

    it('does not seed or return band templates while the band feature flag is off', async () => {
      delete process.env.FEATURE_BAND_MEMBERS;
      const bandTypes = BUILT_IN_TEMPLATE_META
        .filter((row) => 'featureFlag' in row)
        .map((row) => row.value);
      const bandTypeSet = new Set<string>(bandTypes);
      const nonBandTemplates = seededTemplates.filter((template) => !bandTypeSet.has(template.builtInType));
      repo.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(seededTemplates);
      repo.seedBuiltIns.mockResolvedValue(undefined);

      const result = await service.findAll('u1');

      expect(repo.seedBuiltIns).toHaveBeenCalledWith('u1', ALL_BUILT_IN_TYPES.filter((type) => !bandTypeSet.has(type)));
      expect(result).toEqual(nonBandTemplates);
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

    it('treats a feature-flagged template as not found while its flag is off', async () => {
      delete process.env.FEATURE_BAND_MEMBERS;
      repo.findOne.mockResolvedValue({ ...builtInTemplate, builtInType: 'band_invite' });

      await expect(service.findOne('u1', 'band-template')).rejects.toThrow(NotFoundException);
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

  describe('resetToDefault', () => {
    it('resets content to the default for an editable band message template', async () => {
      const bandMessageTemplate = { ...builtInTemplate, builtInType: 'band_invite_message' };
      repo.findOne.mockResolvedValue(bandMessageTemplate);
      const updated = { ...bandMessageTemplate };
      repo.update.mockResolvedValue(updated);
      await service.resetToDefault('u1', 't2');
      expect(repo.update).toHaveBeenCalledWith('t2', {
        content: getDefaultContent('band_invite_message'),
      });
    });

    it('throws NotFoundException when template is not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.resetToDefault('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for a custom template', async () => {
      repo.findOne.mockResolvedValue(customTemplate);
      await expect(service.resetToDefault('u1', 't1')).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
