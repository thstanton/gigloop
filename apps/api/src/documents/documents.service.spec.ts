import { DocumentsService, assertOwnAssetUrl } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';

// SSRF guard for the server-side image fetch that embeds a musician's logo into a PDF.
// logoUrl is user-settable, so the fetch must only ever hit our own R2 public bucket.
describe('assertOwnAssetUrl (SSRF guard)', () => {
  const original = process.env.R2_PUBLIC_URL;
  beforeAll(() => {
    process.env.R2_PUBLIC_URL = 'https://pub-abc.r2.dev';
  });
  afterAll(() => {
    process.env.R2_PUBLIC_URL = original;
  });

  it('allows a URL on the configured R2 public origin', () => {
    expect(() => assertOwnAssetUrl('https://pub-abc.r2.dev/logos/u1')).not.toThrow();
  });

  // The guard keys on origin (scheme + host + port), so a link-local / loopback host is refused
  // whatever the scheme — https payloads here still exercise the SSRF-target rejection.
  it.each([
    'https://169.254.169.254/latest/meta-data/',
    'https://localhost:3000/internal',
    'https://127.0.0.1:6379/',
    'https://evil.example.com/pub-abc.r2.dev/logo.png',
    'file:///etc/passwd',
    'not a url',
  ])('refuses a non-allowlisted URL: %s', (url) => {
    expect(() => assertOwnAssetUrl(url)).toThrow();
  });

  it('throws when R2_PUBLIC_URL is not configured', () => {
    delete process.env.R2_PUBLIC_URL;
    expect(() => assertOwnAssetUrl('https://pub-abc.r2.dev/logos/u1')).toThrow();
    process.env.R2_PUBLIC_URL = 'https://pub-abc.r2.dev';
  });
});

// Wiring test for the per-document portal-visibility verdict (#580): proves findByBooking feeds
// the shared authority the right activeContractId + bookingCancelled from
// findBookingVisibilityContext — not just that the authority works in isolation.
describe('DocumentsService.findByBooking (portal visibility wiring)', () => {
  const userId = 'u1';
  const bookingId = 'b1';
  const activeContractId = 'c-active';

  function makeService(docs: unknown[], ctx: unknown) {
    const repo = {
      findByBooking: jest.fn().mockResolvedValue(docs),
      findBookingVisibilityContext: jest.fn().mockResolvedValue(ctx),
    } as unknown as DocumentsRepository;
    const storage = {
      getPublicUrl: jest.fn().mockReturnValue('https://example.com/doc.pdf'),
    } as unknown as StorageService;
    return new DocumentsService({} as unknown as PrismaService, repo, storage);
  }

  const doc = (over: Record<string, unknown>) => ({
    id: 'd',
    storageKey: 'k',
    createdAt: new Date('2026-07-01'),
    ...over,
  });

  it('computes a per-document verdict across every type × backing-status', async () => {
    const service = makeService(
      [
        doc({ id: 'contract-active', type: 'CONTRACT', contractId: activeContractId }),
        doc({ id: 'contract-old', type: 'CONTRACT', contractId: 'c-old' }),
        doc({ id: 'invoice-sent', type: 'INVOICE', invoice: { status: 'SENT' } }),
        doc({ id: 'invoice-issued', type: 'INVOICE', invoice: { status: 'ISSUED' } }),
        doc({ id: 'invoice-void', type: 'INVOICE', invoice: { status: 'VOID' } }),
        doc({ id: 'song-list', type: 'SONG_LIST' }),
        doc({ id: 'upload', type: 'UPLOAD' }),
      ],
      { status: 'CONFIRMED', contracts: [{ id: activeContractId }] },
    );

    const result = await service.findByBooking(userId, bookingId);
    const byId = Object.fromEntries(result.map((d) => [d.id, d.portalVisibility]));

    expect(byId['contract-active']).toEqual({ visible: true });
    expect(byId['contract-old']).toEqual({ visible: false, reason: 'voided' });
    expect(byId['invoice-sent']).toEqual({ visible: true });
    expect(byId['invoice-issued']).toEqual({ visible: false, reason: 'until_sent' });
    expect(byId['invoice-void']).toEqual({ visible: false, reason: 'voided' });
    expect(byId['song-list']).toEqual({ visible: true });
    expect(byId['upload']).toEqual({ visible: false, reason: 'not_shared' });
  });

  it('applies the cancelled gate to contract documents only, leaving invoices payable', async () => {
    const service = makeService(
      [
        doc({ id: 'contract-active', type: 'CONTRACT', contractId: activeContractId }),
        doc({ id: 'invoice-sent', type: 'INVOICE', invoice: { status: 'SENT' } }),
      ],
      { status: 'CANCELLED', contracts: [{ id: activeContractId }] },
    );

    const result = await service.findByBooking(userId, bookingId);
    const byId = Object.fromEntries(result.map((d) => [d.id, d.portalVisibility]));

    expect(byId['contract-active']).toEqual({ visible: false, reason: 'cancelled' });
    expect(byId['invoice-sent']).toEqual({ visible: true });
  });

  it('treats a missing booking context as no active contract (contract PDFs read voided)', async () => {
    const service = makeService([doc({ id: 'contract', type: 'CONTRACT', contractId: 'c1' })], null);
    const result = await service.findByBooking(userId, bookingId);
    expect(result[0].portalVisibility).toEqual({ visible: false, reason: 'voided' });
  });
});
