import { PerformanceFormatsService } from './performance-formats.service';
import { PerformanceFormatsRepository } from './performance-formats.repository';

type MockRepo = {
  countByUserId: jest.Mock;
  findAll: jest.Mock;
  createMany: jest.Mock;
};

function makeRepo(): MockRepo {
  return {
    countByUserId: jest.fn(),
    findAll: jest.fn(),
    createMany: jest.fn(),
  };
}

const format = { id: 'f1', label: 'Wedding Ceremony', slots: [] };

describe('PerformanceFormatsService', () => {
  let service: PerformanceFormatsService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new PerformanceFormatsService(repo as unknown as PerformanceFormatsRepository);
  });

  it('seeds 7 defaults and returns them on first call', async () => {
    repo.countByUserId.mockResolvedValue(0);
    repo.createMany.mockResolvedValue([]);
    repo.findAll.mockResolvedValue([format]);

    const result = await service.findAll('u1');

    expect(repo.createMany).toHaveBeenCalledWith('u1', expect.arrayContaining([
      expect.objectContaining({ label: 'Wedding Ceremony' }),
    ]));
    expect(repo.createMany.mock.calls[0][1]).toHaveLength(7);
    expect(result).toEqual([format]);
  });

  it('skips seeding when formats already exist', async () => {
    repo.countByUserId.mockResolvedValue(7);
    repo.findAll.mockResolvedValue([format]);

    await service.findAll('u1');

    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('returns formats from repository', async () => {
    repo.countByUserId.mockResolvedValue(3);
    repo.findAll.mockResolvedValue([format]);

    const result = await service.findAll('u1');
    expect(result).toEqual([format]);
  });
});
