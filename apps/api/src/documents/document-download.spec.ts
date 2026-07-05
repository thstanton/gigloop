import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';

// #654 — admin document download endpoint. Proves the ownership check and that
// document payloads now emit the access-controlled app route, not a public URL.
describe('DocumentsService — access-controlled document downloads (#654)', () => {
  const userId = 'u1';

  function makeService(over: Partial<Record<'findById' | 'findByBooking' | 'findBookingVisibilityContext', jest.Mock>> = {}) {
    const repo = {
      findById: over.findById ?? jest.fn(),
      findByBooking: over.findByBooking ?? jest.fn().mockResolvedValue([]),
      findBookingVisibilityContext: over.findBookingVisibilityContext ?? jest.fn().mockResolvedValue(null),
    } as unknown as DocumentsRepository;
    const storage = {
      getPublicUrl: jest.fn((key: string) => `https://pub.example.com/${key}`),
    } as unknown as StorageService;
    return { service: new DocumentsService({} as unknown as PrismaService, repo, storage), repo, storage };
  }

  describe('resolveDownloadTarget', () => {
    it("resolves the caller's own document to a storage URL", async () => {
      const findById = jest.fn().mockResolvedValue({ id: 'd1', userId, storageKey: 'uploads/u1/b1/d1.pdf' });
      const { service, storage } = makeService({ findById });

      const result = await service.resolveDownloadTarget(userId, 'd1');

      expect(findById).toHaveBeenCalledWith('d1', userId);
      expect(storage.getPublicUrl).toHaveBeenCalledWith('uploads/u1/b1/d1.pdf');
      expect(result).toEqual({ url: 'https://pub.example.com/uploads/u1/b1/d1.pdf' });
    });

    it("404s for another user's document (repo scopes by userId → null)", async () => {
      // repo.findById is findFirst({ where: { id, userId } }); a foreign id resolves to null.
      const findById = jest.fn().mockResolvedValue(null);
      const { service, storage } = makeService({ findById });

      await expect(service.resolveDownloadTarget(userId, 'someone-elses-doc')).rejects.toBeInstanceOf(NotFoundException);
      expect(findById).toHaveBeenCalledWith('someone-elses-doc', userId);
      expect(storage.getPublicUrl).not.toHaveBeenCalled();
    });
  });

  describe('document payloads emit the app route, not a public URL', () => {
    it('findByBooking returns /documents/:id/download for each document', async () => {
      const findByBooking = jest.fn().mockResolvedValue([
        { id: 'd1', type: 'UPLOAD', storageKey: 'k1', createdAt: new Date('2026-07-01') },
      ]);
      const { service, storage } = makeService({ findByBooking });

      const [doc] = await service.findByBooking(userId, 'b1');

      expect(doc.url).toBe('/documents/d1/download');
      // The list must never hand out a bare public storage URL.
      expect(storage.getPublicUrl).not.toHaveBeenCalled();
    });
  });
});
