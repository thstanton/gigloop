import { BadRequestException } from '@nestjs/common';
import { PublicProfileService } from './public-profile.service';
import { PublicProfileRepository } from './public-profile.repository';

type MockRepo = { upsertByUserId: jest.Mock; updateByUserId: jest.Mock };

function makeRepo(): MockRepo {
  return { upsertByUserId: jest.fn(), updateByUserId: jest.fn() };
}

describe('PublicProfileService', () => {
  let service: PublicProfileService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new PublicProfileService(repo as unknown as PublicProfileRepository);
  });

  describe('update — brandColour validation', () => {
    it('throws BadRequestException for a plain colour name', () => {
      expect(() => service.update('u1', { brandColour: 'red' })).toThrow(BadRequestException);
    });

    it('throws for a hex value without # prefix', () => {
      expect(() => service.update('u1', { brandColour: '3B82F6' })).toThrow(BadRequestException);
    });

    it('throws for a 3-digit hex shorthand', () => {
      expect(() => service.update('u1', { brandColour: '#F00' })).toThrow(BadRequestException);
    });

    it('accepts a valid 6-digit hex colour', async () => {
      repo.updateByUserId.mockResolvedValue({ userId: 'u1' });
      await expect(service.update('u1', { brandColour: '#3B82F6' })).resolves.toBeDefined();
    });

    it('accepts an update with no brandColour field', async () => {
      repo.updateByUserId.mockResolvedValue({ userId: 'u1' });
      await expect(service.update('u1', { displayName: 'Mick' })).resolves.toBeDefined();
    });
  });

  describe('findOrCreate', () => {
    it('delegates to repository upsert', async () => {
      const profile = { userId: 'u1', businessName: '' };
      repo.upsertByUserId.mockResolvedValue(profile);
      const result = await service.findOrCreate('u1');
      expect(repo.upsertByUserId).toHaveBeenCalledWith('u1');
      expect(result).toBe(profile);
    });
  });
});
