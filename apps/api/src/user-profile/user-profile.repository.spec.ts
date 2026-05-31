import { UserProfileRepository } from './user-profile.repository';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../common/crypto';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
});

type MockPrisma = {
  userProfile: { upsert: jest.Mock; update: jest.Mock };
};

function makePrisma(): MockPrisma {
  return { userProfile: { upsert: jest.fn(), update: jest.fn() } };
}

describe('UserProfileRepository', () => {
  let repo: UserProfileRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new UserProfileRepository(prisma as unknown as PrismaService);
  });

  describe('upsertByUserId', () => {
    it('creates record with correct userId', async () => {
      prisma.userProfile.upsert.mockResolvedValue({ userId: 'u1', bankDetails: null });
      await repo.upsertByUserId('u1');
      expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ userId: 'u1' }) }),
      );
    });

    it('returns null bankDetails unchanged', async () => {
      prisma.userProfile.upsert.mockResolvedValue({ userId: 'u1', bankDetails: null });
      const result = await repo.upsertByUserId('u1');
      expect(result.bankDetails).toBeNull();
    });
  });

  describe('updateByUserId', () => {
    it('encrypts bankDetails before writing to DB', async () => {
      const plaintext = 'sort: 12-34-56, acc: 12345678';
      prisma.userProfile.upsert.mockImplementation(async ({ update }: { update: { bankDetails?: string | null } }) => ({
        userId: 'u1',
        bankDetails: update.bankDetails,
      }));

      await repo.updateByUserId('u1', { bankDetails: plaintext });

      const written = prisma.userProfile.upsert.mock.calls[0][0].update.bankDetails;
      expect(written).not.toBe(plaintext);
      expect(decrypt(written)).toBe(plaintext);
    });

    it('returns decrypted bankDetails', async () => {
      const plaintext = 'sort: 12-34-56, acc: 12345678';
      prisma.userProfile.upsert.mockImplementation(async ({ update }: { update: { bankDetails?: string | null } }) => ({
        userId: 'u1',
        bankDetails: update.bankDetails,
      }));

      const result = await repo.updateByUserId('u1', { bankDetails: plaintext });
      expect(result.bankDetails).toBe(plaintext);
    });

    it('does not encrypt when bankDetails is not in the update', async () => {
      prisma.userProfile.upsert.mockResolvedValue({ userId: 'u1', bankDetails: null });
      await repo.updateByUserId('u1', { address: '123 Main St' });
      const written = prisma.userProfile.upsert.mock.calls[0][0].update;
      expect(written.bankDetails).toBeUndefined();
    });

    it('passes null bankDetails through without encrypting', async () => {
      prisma.userProfile.upsert.mockResolvedValue({ userId: 'u1', bankDetails: null });
      await repo.updateByUserId('u1', { bankDetails: null });
      const written = prisma.userProfile.upsert.mock.calls[0][0].update.bankDetails;
      expect(written).toBeNull();
    });
  });
});
