import { SongGenre } from '@prisma/client';
import { SongsRepository } from './songs.repository';
import { PrismaService } from '../prisma/prisma.service';

type MockPrisma = {
  song: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function makePrisma(): MockPrisma {
  return {
    song: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('SongsRepository', () => {
  let repo: SongsRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new SongsRepository(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('scopes query to userId and orders by artist then title', async () => {
      prisma.song.findMany.mockResolvedValue([]);
      await repo.findAll('u1');
      const call = prisma.song.findMany.mock.calls[0][0];
      expect(call.where.userId).toBe('u1');
      expect(call.orderBy).toEqual([{ artist: 'asc' }, { title: 'asc' }]);
    });

    it('applies genre filter when provided', async () => {
      prisma.song.findMany.mockResolvedValue([]);
      await repo.findAll('u1', SongGenre.JAZZ);
      const where = prisma.song.findMany.mock.calls[0][0].where;
      expect(where.genre).toBe(SongGenre.JAZZ);
    });

    it('applies active filter when provided', async () => {
      prisma.song.findMany.mockResolvedValue([]);
      await repo.findAll('u1', undefined, false);
      const where = prisma.song.findMany.mock.calls[0][0].where;
      expect(where.active).toBe(false);
    });

    it('omits genre and active from where clause when not provided', async () => {
      prisma.song.findMany.mockResolvedValue([]);
      await repo.findAll('u1');
      const where = prisma.song.findMany.mock.calls[0][0].where;
      expect(where.genre).toBeUndefined();
      expect(where.active).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('queries by id and userId', async () => {
      prisma.song.findFirst.mockResolvedValue(null);
      await repo.findOne('u1', 's1');
      expect(prisma.song.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', userId: 'u1' },
      });
    });
  });

  describe('create', () => {
    it('passes userId and dto to Prisma', async () => {
      const song = { id: 's1' };
      prisma.song.create.mockResolvedValue(song);
      const dto = { title: 'Clair de Lune', genre: SongGenre.CLASSICAL };
      const result = await repo.create('u1', dto);
      expect(prisma.song.create).toHaveBeenCalledWith({
        data: { userId: 'u1', ...dto },
      });
      expect(result).toBe(song);
    });
  });

  describe('update', () => {
    it('updates by id with provided data', async () => {
      const updated = { id: 's1', active: false };
      prisma.song.update.mockResolvedValue(updated);
      const result = await repo.update('s1', { active: false });
      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { active: false },
      });
      expect(result).toBe(updated);
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      const deleted = { id: 's1' };
      prisma.song.delete.mockResolvedValue(deleted);
      const result = await repo.delete('s1');
      expect(prisma.song.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
      expect(result).toBe(deleted);
    });
  });
});
