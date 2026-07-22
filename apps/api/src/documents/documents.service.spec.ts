import { DocumentsService, assertOwnAssetUrl } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SongListPdfData } from './song-list-document';

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

// #769: the song-list generator must resolve a raw R2 logo URL to a data URL before handing it
// to pdfmake — a raw https URL throws ENOENT in pdfmake's Node image loader (treated as a file
// path), which previously killed the PDF + notification silently. A logo-less fixture cannot
// catch this, so this test exercises the logo path end-to-end.
describe('DocumentsService.generateAndStoreSongListPdf (logo → data URL, #769)', () => {
  const R2 = 'https://pub-abc.r2.dev';
  const original = process.env.R2_PUBLIC_URL;
  // 1×1 transparent PNG.
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    process.env.R2_PUBLIC_URL = R2;
  });
  afterAll(() => {
    process.env.R2_PUBLIC_URL = original;
    globalThis.fetch = originalFetch;
  });

  const songListData: SongListPdfData = {
    musicianName: 'Test Musician',
    businessName: 'Test Musician',
    email: 'test@example.com',
    brandColour: '#1a1a1a',
    customerName: 'Test Client',
    bookingDate: '2024-06-01',
    venueName: null,
    specialRequests: [],
    selectedSongs: [{ id: 's1', title: 'Perfect', artist: 'Ed Sheeran', genre: 'Pop' }],
    notes: null,
    submittedAt: '2024-05-01 10:00:00 UTC',
  };

  function makeService() {
    const repo = {
      findSongListForBooking: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({ id: 'doc1' }),
    } as unknown as DocumentsRepository;
    const storage = {
      putDocument: jest.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;
    return {
      service: new DocumentsService({} as unknown as PrismaService, repo, storage),
      storage,
    };
  }

  it('fetches the raw R2 logo URL and produces a valid PDF (regression: pdfmake ENOENT on raw URL)', async () => {
    originalFetch = globalThis.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () =>
        pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength),
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const { service, storage } = makeService();
    const data: SongListPdfData = { ...songListData, logoUrl: `${R2}/logos/u1.png` };
    const { buffer } = await service.generateAndStoreSongListPdf('u1', 'b1', data);

    // The logo was fetched (through the SSRF-guarded fetchAsDataUrl) and embedded as a data URL...
    expect(fetchMock).toHaveBeenCalledWith(`${R2}/logos/u1.png`, expect.objectContaining({ redirect: 'error' }));
    expect(data.logoUrl).toMatch(/^data:image\//);
    // ...and a real PDF was produced and stored, rather than the whole path throwing.
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(storage.putDocument).toHaveBeenCalledWith('song-lists/u1/b1.pdf', buffer, 'application/pdf');
  });
});
