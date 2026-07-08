import { BadRequestException } from '@nestjs/common';
import { PublicProfileService } from './public-profile.service';
import { PublicProfileRepository } from './public-profile.repository';
import { StorageService } from '../storage/storage.service';

type MockRepo = { upsertByUserId: jest.Mock; updateByUserId: jest.Mock };

function makeRepo(): MockRepo {
  return { upsertByUserId: jest.fn(), updateByUserId: jest.fn() };
}

const mockStorage = {
  getPresignedUploadUrl: jest.fn(),
  deleteAsset: jest.fn(),
  getPublicUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
} as unknown as StorageService;

describe('PublicProfileService', () => {
  let service: PublicProfileService;
  let repo: MockRepo;

  beforeEach(() => {
    repo = makeRepo();
    service = new PublicProfileService(repo as unknown as PublicProfileRepository, mockStorage);
  });

  describe('update — brandColour validation', () => {
    it('throws BadRequestException for a plain colour name', () => {
      expect(() => service.update('u1', { clientPortalConfig: { brandColour: 'red' } })).toThrow(BadRequestException);
    });

    it('throws for a hex value without # prefix', () => {
      expect(() => service.update('u1', { clientPortalConfig: { brandColour: '3B82F6' } })).toThrow(BadRequestException);
    });

    it('throws for a 3-digit hex shorthand', () => {
      expect(() => service.update('u1', { clientPortalConfig: { brandColour: '#F00' } })).toThrow(BadRequestException);
    });

    it('accepts a valid 6-digit hex colour', async () => {
      repo.updateByUserId.mockResolvedValue({ userId: 'u1' });
      await expect(service.update('u1', { clientPortalConfig: { brandColour: '#3B82F6' } })).resolves.toBeDefined();
    });

    it('accepts an update with no brandColour field', async () => {
      repo.updateByUserId.mockResolvedValue({ userId: 'u1' });
      await expect(service.update('u1', { displayName: 'Mick' })).resolves.toBeDefined();
    });
  });

  describe('update — asset URL validation (SSRF guard)', () => {
    // mockStorage.getPublicUrl returns https://cdn.example.com/<key>, so u1's own logo is
    // https://cdn.example.com/logos/u1 — the only value update() may accept for logoUrl.
    it('rejects a logoUrl pointing at an arbitrary host', () => {
      expect(() => service.update('u1', { logoUrl: 'https://169.254.169.254/latest/meta-data/' })).toThrow(
        BadRequestException,
      );
      expect(repo.updateByUserId).not.toHaveBeenCalled();
    });

    it("rejects a logoUrl for another user's key", () => {
      expect(() => service.update('u1', { logoUrl: 'https://cdn.example.com/logos/u2' })).toThrow(
        BadRequestException,
      );
    });

    it('rejects a photo pointing at an internal service', () => {
      expect(() => service.update('u1', { photo: 'https://localhost:3000/admin' })).toThrow(BadRequestException);
    });

    it("accepts this user's own uploaded logo and photo URLs", async () => {
      repo.updateByUserId.mockResolvedValue({ userId: 'u1' });
      await expect(
        service.update('u1', {
          logoUrl: 'https://cdn.example.com/logos/u1',
          photo: 'https://cdn.example.com/photos/u1',
        }),
      ).resolves.toBeDefined();
    });

    it('accepts null to clear the logo', async () => {
      repo.updateByUserId.mockResolvedValue({ userId: 'u1' });
      await expect(service.update('u1', { logoUrl: null })).resolves.toBeDefined();
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
