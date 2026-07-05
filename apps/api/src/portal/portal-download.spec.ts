import { NotFoundException } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalRepository } from './portal.repository';
import { StorageService } from '../storage/storage.service';

// #655 — portal document download endpoints. Proves the endpoints serve a doc
// only when it belongs to the token's booking AND passes the shared portal
// visibility authority, and that payloads now carry app routes not public URLs.
describe('PortalService — access-controlled portal downloads (#655)', () => {
  const token = 'portal-token';

  const doc = (over: Record<string, unknown>) => ({
    id: 'd',
    storageKey: 'k',
    type: 'SONG_LIST',
    contractId: null,
    invoice: null,
    createdAt: new Date('2026-07-01'),
    ...over,
  });

  // Only `repo` (position 1) and `storage` (position 7) are exercised by the
  // download resolvers; the other eight collaborators are irrelevant here. `never`
  // is assignable to every parameter type, so we can fill the unused slots without
  // stubbing eight interfaces (and without `any`).
  const unused = undefined as unknown as never;
  function makeService(booking: unknown) {
    const repo = { findBookingByToken: jest.fn().mockResolvedValue(booking) } as unknown as PortalRepository;
    const storage = {
      getPresignedDownloadUrl: jest.fn((key: string) => Promise.resolve(`https://storage.example/${key}?sig=abc`)),
    } as unknown as StorageService;
    const svc = new PortalService(
      repo, unused, unused, unused, unused, unused, storage, unused, unused, unused,
    );
    return { svc, repo, storage };
  }

  const booking = (over: Record<string, unknown>) => ({
    status: 'CONFIRMED',
    contracts: [],
    documents: [],
    ...over,
  });

  describe('resolvePortalDocumentUrl', () => {
    it('resolves a visible document to its storage URL', async () => {
      const { svc, storage } = makeService(
        booking({ documents: [doc({ id: 'song', type: 'SONG_LIST', storageKey: 'song-lists/x.pdf' })] }),
      );

      const url = await svc.resolvePortalDocumentUrl(token, 'song');

      expect(url).toBe('https://storage.example/song-lists/x.pdf?sig=abc');
      expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith('song-lists/x.pdf');
    });

    it('404s for an invalid token (no booking) without touching storage', async () => {
      const { svc, storage } = makeService(null);
      await expect(svc.resolvePortalDocumentUrl('bad-token', 'song')).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('404s for a document that is not on this booking', async () => {
      const { svc } = makeService(booking({ documents: [doc({ id: 'song', type: 'SONG_LIST' })] }));
      await expect(svc.resolvePortalDocumentUrl(token, 'other-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for a hidden doc: an ISSUED-but-unsent invoice', async () => {
      const { svc, storage } = makeService(
        booking({ documents: [doc({ id: 'inv', type: 'INVOICE', invoice: { status: 'ISSUED' } })] }),
      );
      await expect(svc.resolvePortalDocumentUrl(token, 'inv')).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('404s for a hidden doc: a cancelled booking’s contract', async () => {
      const { svc } = makeService(
        booking({
          status: 'CANCELLED',
          contracts: [{ id: 'c1' }],
          documents: [doc({ id: 'con', type: 'CONTRACT', contractId: 'c1' })],
        }),
      );
      await expect(svc.resolvePortalDocumentUrl(token, 'con')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('serves a visible SENT invoice', async () => {
      const { svc } = makeService(
        booking({ documents: [doc({ id: 'inv', type: 'INVOICE', invoice: { status: 'SENT' }, storageKey: 'inv/1.pdf' })] }),
      );
      await expect(svc.resolvePortalDocumentUrl(token, 'inv')).resolves.toBe('https://storage.example/inv/1.pdf?sig=abc');
    });
  });

  describe('resolvePortalSignedContractUrl (variant)', () => {
    it('resolves the booking’s visible signed contract', async () => {
      const { svc } = makeService(
        booking({
          contracts: [{ id: 'c1' }],
          documents: [doc({ id: 'con', type: 'CONTRACT', contractId: 'c1', storageKey: 'contracts/signed.pdf' })],
        }),
      );
      await expect(svc.resolvePortalSignedContractUrl(token)).resolves.toBe('https://storage.example/contracts/signed.pdf?sig=abc');
    });

    it('404s when there is no visible contract', async () => {
      const { svc } = makeService(booking({ documents: [doc({ id: 'song', type: 'SONG_LIST' })] }));
      await expect(svc.resolvePortalSignedContractUrl(token)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s on a cancelled booking (contract concern hidden)', async () => {
      const { svc } = makeService(
        booking({
          status: 'CANCELLED',
          contracts: [{ id: 'c1' }],
          documents: [doc({ id: 'con', type: 'CONTRACT', contractId: 'c1' })],
        }),
      );
      await expect(svc.resolvePortalSignedContractUrl(token)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
