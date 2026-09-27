// The upload path must ask the ADR-0054 authority for its portal-visibility verdict rather than
// assert one of its own (#802). Wrapping the real function in a jest.fn leaves every other test's
// behaviour identical while letting the upload tests prove the authority was actually *consulted* —
// an assertion on the returned value alone would stay green if someone reinstated a literal.
jest.mock('../portal/portal-visibility', () => {
  const actual = jest.requireActual('../portal/portal-visibility');
  return { ...actual, resolveDocumentVisibility: jest.fn(actual.resolveDocumentVisibility) };
});

import { DocumentsService, assertOwnAssetUrl } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveDocumentVisibility } from '../portal/portal-visibility';
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

  function makeService(docs: unknown[], ctx: unknown, seriesDoc: unknown = null) {
    const repo = {
      findByBooking: jest.fn().mockResolvedValue(docs),
      findBookingVisibilityContext: jest.fn().mockResolvedValue(ctx),
      findActiveSeriesInvoiceDocument: jest.fn().mockResolvedValue(seriesDoc),
    } as unknown as DocumentsRepository;
    const storage = {
      getPublicUrl: jest.fn().mockReturnValue('https://example.com/doc.pdf'),
    } as unknown as StorageService;
    return { service: new DocumentsService({} as unknown as PrismaService, repo, storage), repo };
  }

  const doc = (over: Record<string, unknown>) => ({
    id: 'd',
    storageKey: 'k',
    createdAt: new Date('2026-07-01'),
    bookingId,
    ...over,
  });

  it('computes a per-document verdict across every type × backing-status', async () => {
    const { service } = makeService(
      [
        doc({ id: 'contract-active', type: 'CONTRACT', contractId: activeContractId }),
        doc({ id: 'contract-old', type: 'CONTRACT', contractId: 'c-old' }),
        doc({ id: 'invoice-sent', type: 'INVOICE', invoice: { status: 'SENT' } }),
        doc({ id: 'invoice-issued', type: 'INVOICE', invoice: { status: 'ISSUED' } }),
        doc({ id: 'invoice-void', type: 'INVOICE', invoice: { status: 'VOID' } }),
        doc({ id: 'song-list', type: 'SONG_LIST' }),
        doc({ id: 'upload', type: 'UPLOAD' }),
        doc({ id: 'call-sheet', type: 'CALL_SHEET' }),
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
    // #893: a CALL_SHEET row asks the authority with `audience: 'BAND'`, not `CLIENT` — it's the
    // one admin-list document that is always visible-on-band, never visible-on-client.
    expect(byId['call-sheet']).toEqual({ visible: true });
  });

  // #893, ADR-0073 §7: the admin-side call-sheet row reuses PortalVisibility with "Visible on Band
  // Portal" — proving the wiring actually asks with `audience: 'BAND'` for this one type, not just
  // that the verdict happens to come out visible (which a CLIENT-audience default could also give).
  it('asks the authority for CALL_SHEET with audience BAND, not CLIENT', async () => {
    const { service } = makeService(
      [doc({ id: 'call-sheet', type: 'CALL_SHEET' })],
      { status: 'CONFIRMED', contracts: [] },
    );
    await service.findByBooking(userId, bookingId);
    const mockedResolve = resolveDocumentVisibility as jest.Mock;
    const callSheetCall = mockedResolve.mock.calls.find(([d]) => d.type === 'CALL_SHEET');
    expect(callSheetCall?.[2]).toBe('BAND');
  });

  it('applies the cancelled gate to contract documents only, leaving invoices payable', async () => {
    const { service } = makeService(
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
    const { service } = makeService([doc({ id: 'contract', type: 'CONTRACT', contractId: 'c1' })], null);
    const result = await service.findByBooking(userId, bookingId);
    expect(result[0].portalVisibility).toEqual({ visible: false, reason: 'voided' });
  });

  it('marks every ordinary booking-owned document isSeriesInvoice: false', async () => {
    const { service } = makeService(
      [doc({ id: 'invoice-sent', type: 'INVOICE', invoice: { status: 'SENT' } })],
      { status: 'CONFIRMED', contracts: [] },
    );
    const result = await service.findByBooking(userId, bookingId);
    expect(result[0].isSeriesInvoice).toBe(false);
  });
});

// #848: a BookingSeries invoice's document belongs to no single booking (`bookingId: null`), yet
// is discoverable from every member booking's Documents card because it covers all of them
// (CONTEXT.md → "The one Document with no Booking"). It must never read as portal-visible through
// a member booking regardless of its invoice's status — the ownership gate lives in the shared
// authority (ADR-0054 amendment), not here, but this proves findByBooking threads it correctly.
describe('DocumentsService.findByBooking (series invoice document union, #848)', () => {
  const userId = 'u1';
  const bookingId = 'b1';
  const seriesId = 's1';

  function makeService(seriesDoc: unknown) {
    const repo = {
      findByBooking: jest.fn().mockResolvedValue([]),
      findBookingVisibilityContext: jest
        .fn()
        .mockResolvedValue({ status: 'CONFIRMED', seriesId, contracts: [] }),
      findActiveSeriesInvoiceDocument: jest.fn().mockResolvedValue(seriesDoc),
    } as unknown as DocumentsRepository;
    const storage = {
      getPublicUrl: jest.fn().mockReturnValue('https://example.com/doc.pdf'),
    } as unknown as StorageService;
    return { service: new DocumentsService({} as unknown as PrismaService, repo, storage), repo };
  }

  const seriesDoc = (invoiceStatus: string) => ({
    id: 'd-series',
    storageKey: 'k',
    createdAt: new Date('2026-07-01'),
    bookingId: null,
    type: 'INVOICE',
    invoiceId: 'inv-series',
    invoice: { status: invoiceStatus },
  });

  it('unions the active series invoice document into a member booking\'s list', async () => {
    const { service } = makeService(seriesDoc('SENT'));
    const result = await service.findByBooking(userId, bookingId);
    expect(result.map((d) => d.id)).toEqual(['d-series']);
    expect(result[0].isSeriesInvoice).toBe(true);
  });

  it('looks the series document up by the booking\'s own seriesId', async () => {
    const { service, repo } = makeService(seriesDoc('SENT'));
    await service.findByBooking(userId, bookingId);
    expect(repo.findActiveSeriesInvoiceDocument).toHaveBeenCalledWith(userId, seriesId);
  });

  it.each(['SENT', 'PAID', 'ISSUED'])(
    'never marks the series document portal-visible, whatever its invoice status (%s)',
    async (status) => {
      const { service } = makeService(seriesDoc(status));
      const result = await service.findByBooking(userId, bookingId);
      expect(result[0].portalVisibility).toEqual({ visible: false, reason: 'other_booking' });
    },
  );

  it('adds nothing when the booking is not in a series', async () => {
    const repo = {
      findByBooking: jest.fn().mockResolvedValue([]),
      findBookingVisibilityContext: jest
        .fn()
        .mockResolvedValue({ status: 'CONFIRMED', seriesId: null, contracts: [] }),
      findActiveSeriesInvoiceDocument: jest.fn(),
    } as unknown as DocumentsRepository;
    const storage = {} as unknown as StorageService;
    const service = new DocumentsService({} as unknown as PrismaService, repo, storage);

    const result = await service.findByBooking(userId, bookingId);
    expect(result).toEqual([]);
    expect(repo.findActiveSeriesInvoiceDocument).not.toHaveBeenCalled();
  });

  it('adds nothing when the series has no active (non-VOID) invoice document', async () => {
    const { service } = makeService(null);
    const result = await service.findByBooking(userId, bookingId);
    expect(result).toEqual([]);
  });
});

// #802: a freshly uploaded document's verdict used to be a literal in the controller, making it a
// second place deciding what an UPLOAD is worth on the portal alongside the ADR-0054 authority.
// They agreed, so nothing was broken — the defect was the duplication, and these tests pin the
// coupling rather than the value it currently produces.
describe('DocumentsService.uploadDocument (verdict from the authority, #802)', () => {
  const created = {
    id: 'd-upload',
    type: 'UPLOAD',
    storageKey: 'uploads/u1/b1/d-upload.pdf',
    createdAt: new Date('2026-07-25'),
    invoiceId: null,
    contractId: null,
    name: 'Rider.pdf',
  };

  function makeService() {
    const repo = {
      create: jest.fn().mockResolvedValue(created),
    } as unknown as DocumentsRepository;
    const storage = {
      putDocument: jest.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;
    return new DocumentsService({} as unknown as PrismaService, repo, storage);
  }

  const upload = () =>
    makeService().uploadDocument('u1', 'b1', Buffer.from('%PDF-1.4'), 'Rider.pdf');

  beforeEach(() => {
    (resolveDocumentVisibility as jest.Mock).mockClear();
  });

  it('carries the verdict the authority returns for an UPLOAD', async () => {
    expect((await upload()).portalVisibility).toEqual({ visible: false, reason: 'not_shared' });
  });

  // The shared DTO mapper reads invoiceId off the row and derives contractStatus from the type,
  // where the upload endpoint's old inline mapper asserted `null` for both. They agree for an
  // UPLOAD — pinned here so "no wire-shape change" is a tested claim rather than a reasoned one.
  it('leaves the invoice and contract fields empty, as the old inline mapper asserted', async () => {
    const doc = await upload();
    expect(doc.invoiceId).toBeNull();
    expect(doc.type).toBe('UPLOAD');
    expect(doc.contract ?? null).toBeNull();
  });

  // The actual regression guard: reinstating a hardcoded verdict anywhere on this path would keep
  // the assertion above green, because the literal and the authority currently agree.
  it('consults the authority rather than deciding the verdict itself', async () => {
    await upload();
    expect(resolveDocumentVisibility).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'UPLOAD' }),
      null,
      'CLIENT',
    );
  });

  it('still returns the access-controlled download route rather than a storage URL', async () => {
    expect((await upload()).url).toBe('/documents/d-upload/download');
  });
});

// The API-side consumer of the invoiced-deposit rule (CONTEXT.md → Invoice → "Invoiced deposit —
// one rule, two consumers"). The VOID exclusion and deterministic ordering live in the Prisma
// `where`/`orderBy`, so the query shape is what these tests pin — a mock returning null proves
// nothing about VOID on its own. getDepositTotal is private; it is invoked via a typed cast.
describe('DocumentsService.getDepositTotal (invoiced deposit for the balance PDF)', () => {
  function makeService(findFirst: jest.Mock) {
    const prisma = { invoice: { findFirst } } as unknown as PrismaService;
    return new DocumentsService(prisma, {} as unknown as DocumentsRepository, {} as unknown as StorageService);
  }
  const call = (service: DocumentsService) =>
    (service as unknown as { getDepositTotal(userId: string, bookingId: string): Promise<string | null> })
      .getDepositTotal('u1', 'b1');

  it('excludes VOID deposits and orders deterministically', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    await call(makeService(findFirst));
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bookingId: 'b1', userId: 'u1', isDeposit: true, status: { not: 'VOID' } }),
        orderBy: expect.objectContaining({ createdAt: expect.anything() }),
      }),
    );
  });

  it('sums the active deposit invoice line items to a fixed-2 string', async () => {
    const findFirst = jest.fn().mockResolvedValue({ lineItems: [{ amount: '100.00' }, { amount: '50.51' }] });
    expect(await call(makeService(findFirst))).toBe('150.51');
  });

  it('returns null when there is no active deposit invoice (gates the deduction off in the PDF)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    expect(await call(makeService(findFirst))).toBeNull();
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

// #893, ADR-0073 §4: the call sheet is generated on demand, never versioned — a download produces
// no `Document` row, and a send (the row-on-send capability this issue creates for #881) creates
// exactly one, with no replace-existing (unlike the invoice/song-list generators above).
describe('DocumentsService.generateCallSheetPdfBuffer / generateAndStoreCallSheetPdf (#893)', () => {
  const booking = {
    title: 'The Hartley Wedding',
    date: new Date('2027-06-12T00:00:00Z'),
    venue: null,
    sets: [],
    packages: [],
    lineups: [],
    bandChairs: [
      { id: 'chair-1', role: 'Vocals', lineupId: 'l1', memberId: 'm1', member: { contact: { name: 'Dave' } } },
      { id: 'chair-2', role: 'Bass', lineupId: 'l1', memberId: null, member: null },
    ],
  };
  const publicProfile = {
    businessName: 'Test Musician',
    displayName: null,
    email: 'test@example.com',
    phone: null,
    logoUrl: null,
    clientPortalConfig: null,
  };

  function makeService() {
    const prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking) },
      publicProfile: { findUnique: jest.fn().mockResolvedValue(publicProfile) },
    } as unknown as PrismaService;
    const repo = {
      create: jest.fn().mockResolvedValue({ id: 'doc-call-sheet' }),
      findById: jest.fn().mockResolvedValue({
        id: 'doc-call-sheet', userId: 'u1', bookingId: 'b1', type: 'CALL_SHEET', storageKey: 'call-sheets/u1/b1/id.pdf',
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as DocumentsRepository;
    const storage = {
      putDocument: jest.fn().mockResolvedValue(undefined),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;
    return { service: new DocumentsService(prisma, repo, storage), prisma, repo, storage };
  }

  it('generates a valid PDF, scoped to the caller\'s own booking, without storing anything', async () => {
    const { service, prisma, repo, storage } = makeService();
    const buffer = await service.generateCallSheetPdfBuffer('u1', 'b1');

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'b1', userId: 'u1' } }),
    );
    // The band-portal download creates no `Document` row (ADR-0073 §4: "generated on demand,
    // never versioned" — the link is current by construction, not a stored snapshot).
    expect(storage.putDocument).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('stores the PDF and creates exactly one CALL_SHEET Document on send, with no replace-existing', async () => {
    const { service, repo, storage } = makeService();
    const { buffer, documentId } = await service.generateAndStoreCallSheetPdf('u1', 'b1');

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(storage.putDocument).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith('u1', 'b1', 'CALL_SHEET', expect.any(String));
    expect(documentId).toBe('doc-call-sheet');
  });

  it('deletes the stored document artifact when its email send fails', async () => {
    const { service, repo, storage } = makeService();
    await service.discardUnsentCallSheet('u1', 'b1', 'doc-call-sheet');

    expect(repo.findById).toHaveBeenCalledWith('doc-call-sheet', 'u1');
    expect(storage.deleteDocument).toHaveBeenCalledWith('call-sheets/u1/b1/id.pdf');
    expect(repo.delete).toHaveBeenCalledWith('doc-call-sheet');
  });

  it('refuses to discard a document outside the call-sheet booking', async () => {
    const { service, repo, storage } = makeService();
    (repo.findById as jest.Mock).mockResolvedValue({
      id: 'doc-call-sheet', userId: 'u1', bookingId: 'other-booking', type: 'CALL_SHEET', storageKey: 'other.pdf',
    });

    await expect(service.discardUnsentCallSheet('u1', 'b1', 'doc-call-sheet')).rejects.toThrow('Call sheet document not found');
    expect(storage.deleteDocument).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('404s when the booking does not belong to the caller', async () => {
    const { service, prisma } = makeService();
    (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.generateCallSheetPdfBuffer('u1', 'b1')).rejects.toThrow('Booking not found');
  });
});
