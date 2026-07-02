/**
 * Integration tests for PortalService PDF flows — real pdfmake, mocked DB/storage/email.
 * Verifies font loading and PDF generation for signContract and submitMusicForm.
 */
import { PortalService, isPortalVisibleDocument } from './portal.service';
import { DocumentsService } from '../documents/documents.service';
import { StorageService } from '../storage/storage.service';
import { DocumentsRepository } from '../documents/documents.repository';
import { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';

// DocumentsService imports pdfmake and configures fonts at module load time.

const userId = 'u1';
const bookingId = 'b1';
const contractId = 'c1';
const token = 'portal-token';

const publicProfile = {
  businessName: 'Test Musician',
  displayName: 'Test Musician',
  email: 'musician@example.com',
  logoUrl: null,
  clientPortalConfig: { brandColour: '#1a1a1a' },
  bio: null,
  phone: null,
  photo: null,
};

function makeDocumentsService(putObjectMock: jest.Mock) {
  const mockPrisma = {
    publicProfile: {
      findUnique: jest.fn().mockResolvedValue(publicProfile),
    },
  } as unknown as PrismaService;

  const mockStorage = {
    putObject: putObjectMock,
    getPublicUrl: jest.fn().mockReturnValue('https://example.com/doc.pdf'),
  } as unknown as StorageService;

  const mockDocsRepo = {
    findByInvoice: jest.fn().mockResolvedValue(null),
    findSongListForBooking: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'd1' }),
    delete: jest.fn(),
  } as unknown as DocumentsRepository;

  return new DocumentsService(mockPrisma, mockDocsRepo, mockStorage);
}

describe('isPortalVisibleDocument', () => {
  const activeContractId = 'c-active';

  it('shows the active contract document, hides superseded ones', () => {
    expect(isPortalVisibleDocument({ type: 'CONTRACT', contractId: activeContractId }, activeContractId)).toBe(true);
    expect(isPortalVisibleDocument({ type: 'CONTRACT', contractId: 'c-old' }, activeContractId)).toBe(false);
  });

  it('shows invoice documents only when the invoice is SENT or PAID', () => {
    for (const status of ['SENT', 'PAID']) {
      expect(isPortalVisibleDocument({ type: 'INVOICE', invoice: { status } }, activeContractId)).toBe(true);
    }
  });

  it('hides invoice documents for unsent (DRAFT/ISSUED) and VOID invoices', () => {
    for (const status of ['DRAFT', 'ISSUED', 'VOID']) {
      expect(isPortalVisibleDocument({ type: 'INVOICE', invoice: { status } }, activeContractId)).toBe(false);
    }
  });

  it('hides an invoice document whose invoice link has been cleared', () => {
    expect(isPortalVisibleDocument({ type: 'INVOICE', invoice: null }, activeContractId)).toBe(false);
  });

  it('always shows non-contract, non-invoice documents (e.g. song lists)', () => {
    expect(isPortalVisibleDocument({ type: 'SONG_LIST' }, activeContractId)).toBe(true);
  });

  it('never shows UPLOAD documents — they are private musician paperwork (#579)', () => {
    expect(isPortalVisibleDocument({ type: 'UPLOAD' }, activeContractId)).toBe(false);
  });
});

describe('PortalService.signContract (integration)', () => {
  let service: PortalService;
  let markContractSignedMock: jest.Mock;
  let putObjectMock: jest.Mock;

  const booking = {
    id: bookingId,
    userId,
    date: new Date('2026-08-15'),
    title: 'Wedding',
    status: 'PROVISIONAL',
    customer: { name: 'Test Client', greetingName: null },
    venue: { name: 'Test Venue' },
    contracts: [{
      id: contractId,
      status: 'SENT',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This is the contract.' }] }] },
    }],
    invoices: [],
    documents: [],
    musicFormConfig: null,
    musicFormResponse: null,
    depositReceivedAt: null,
    packages: [],
    sets: [],
  };

  const emailContext = {
    customerName: 'Test Client', greetingName: 'Test', bookingDate: '2026-08-15',
    venueName: 'Test Venue', bookingFee: '1000.00', setsSchedule: '',
    musicianName: 'Test Musician', musicianEmail: 'musician@example.com',
    portalLink: 'https://example.com/portal/test',
    issueDate: '', invoiceTotal: '', invoiceDueDate: '',
  };

  beforeEach(() => {
    putObjectMock = jest.fn().mockResolvedValue(undefined);
    const documents = makeDocumentsService(putObjectMock);

    markContractSignedMock = jest.fn().mockResolvedValue({ id: contractId, status: 'SIGNED' });

    service = new PortalService(
      { findBookingByToken: jest.fn().mockResolvedValue(booking) } as unknown as import('./portal.repository').PortalRepository,
      { findByUserId: jest.fn().mockResolvedValue(publicProfile) } as unknown as import('../user-profile/public-profile.repository').PublicProfileRepository,
      {} as unknown as import('../songs/songs.repository').SongsRepository,
      { findDepositInvoice: jest.fn().mockResolvedValue(null) } as unknown as import('../invoices/invoices.repository').InvoicesRepository,
      { buildContext: jest.fn().mockResolvedValue(emailContext), send: jest.fn().mockResolvedValue(undefined) } as unknown as import('../mail/mail.service').MailService,
      documents,
      { getPublicUrl: jest.fn() } as unknown as StorageService,
      { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService,
      { markContractSigned: markContractSignedMock } as unknown as import('../bookings/contract.repository').ContractRepository,
      {} as unknown as import('../bookings/music-form-config.repository').MusicFormConfigRepository,
    );
  });

  it('generates a signed contract PDF and calls markContractSigned', async () => {
    const mockReq = { ip: '127.0.0.1' } as Request;
    // Minimal valid 1×1 transparent PNG required — pdfmake decodes signature image
    const sig = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await service.signContract(token, sig, mockReq);

    expect(putObjectMock).toHaveBeenCalledWith(
      expect.stringContaining('contracts/'),
      expect.any(Buffer),
      'application/pdf',
    );
    const [, buffer] = putObjectMock.mock.calls[0];
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(0);

    expect(markContractSignedMock).toHaveBeenCalledWith(contractId, '127.0.0.1', sig);
  });
});

describe('PortalService.submitMusicForm (integration)', () => {
  let service: PortalService;
  let putObjectMock: jest.Mock;

  const bookingData = {
    id: bookingId,
    userId,
    // #533: a submittable form must be published — the gate rejects a draft.
    musicFormConfig: { keyMoments: [], enabledGenres: ['Pop'], publishedAt: new Date() },
    musicFormResponse: null,
  };

  const bookingForSongList = {
    id: bookingId,
    date: new Date('2026-08-15'),
    title: 'Wedding',
    customer: { name: 'Test Client' },
    venue: null,
  };

  const song = { id: 's1', title: 'Perfect', artist: 'Ed Sheeran', genre: 'Pop' };

  const dto = {
    selectedSongIds: ['s1'],
    specialRequests: [],
    notes: undefined,
  };

  beforeEach(() => {
    putObjectMock = jest.fn().mockResolvedValue(undefined);
    const documents = makeDocumentsService(putObjectMock);

    service = new PortalService(
      { findMusicFormDataByToken: jest.fn().mockResolvedValue(bookingData) } as unknown as import('./portal.repository').PortalRepository,
      { findByUserId: jest.fn().mockResolvedValue(publicProfile) } as unknown as import('../user-profile/public-profile.repository').PublicProfileRepository,
      {
        findByIds: jest.fn().mockResolvedValue([song]),
        findAll: jest.fn().mockResolvedValue([song]),
      } as unknown as import('../songs/songs.repository').SongsRepository,
      {} as unknown as import('../invoices/invoices.repository').InvoicesRepository,
      { send: jest.fn().mockResolvedValue(undefined) } as unknown as import('../mail/mail.service').MailService,
      documents,
      { getPublicUrl: jest.fn() } as unknown as StorageService,
      { evaluate: jest.fn().mockResolvedValue(undefined) } as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService,
      {} as unknown as import('../bookings/contract.repository').ContractRepository,
      {
        upsertMusicFormResponse: jest.fn().mockResolvedValue(undefined),
        findBookingForSongList: jest.fn().mockResolvedValue(bookingForSongList),
      } as unknown as import('../bookings/music-form-config.repository').MusicFormConfigRepository,
    );
  });

  it('generates and stores a song list PDF', async () => {
    await service.submitMusicForm(token, dto);
    // Fire-and-forget uses pdfmake stream internally — wait for event loop to flush
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(putObjectMock).toHaveBeenCalledWith(
      expect.stringContaining('song-lists/'),
      expect.any(Buffer),
      'application/pdf',
    );
    const songListCall = putObjectMock.mock.calls.find(([key]) => key.includes('song-lists'));
    expect(songListCall).toBeDefined();
    const [, buffer] = songListCall!;
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });
});

// #579: the portal token stays valid on a cancelled booking, so the signing endpoints themselves —
// not just the CTA — must refuse. Guards the real leak: a stale tab / direct POST signing a
// cancelled gig's contract.
describe('PortalService contract-signing guards on a cancelled booking (#579)', () => {
  function makeService(bookingOver: Record<string, unknown>) {
    const booking = {
      id: bookingId,
      userId,
      status: 'CANCELLED',
      customer: { name: 'Test Client' },
      contracts: [{ id: contractId, status: 'SENT', content: { type: 'doc', content: [] } }],
      ...bookingOver,
    };
    return new PortalService(
      { findBookingByToken: jest.fn().mockResolvedValue(booking) } as unknown as import('./portal.repository').PortalRepository,
      { findByUserId: jest.fn() } as unknown as import('../user-profile/public-profile.repository').PublicProfileRepository,
      {} as unknown as import('../songs/songs.repository').SongsRepository,
      {} as unknown as import('../invoices/invoices.repository').InvoicesRepository,
      { send: jest.fn() } as unknown as import('../mail/mail.service').MailService,
      {} as unknown as DocumentsService,
      {} as unknown as StorageService,
      {} as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService,
      { markContractSigned: jest.fn() } as unknown as import('../bookings/contract.repository').ContractRepository,
      {} as unknown as import('../bookings/music-form-config.repository').MusicFormConfigRepository,
    );
  }

  it('getContractContent rejects a SENT contract on a cancelled booking', async () => {
    await expect(makeService({}).getContractContent(token)).rejects.toThrow('Contract not found');
  });

  it.each(['SENT', 'SIGNED'])('signContract rejects a %s contract on a cancelled booking', async (status) => {
    const service = makeService({ contracts: [{ id: contractId, status, content: { type: 'doc', content: [] } }] });
    await expect(service.signContract(token, 'sig', { ip: '127.0.0.1' } as Request)).rejects.toThrow(
      'Contract not found',
    );
  });
});

// Regression net for the ADR-0054 refactor (#578): getBookingData's contract + music-form
// visibility outputs must not change when the derivation is routed through the authority.
describe('PortalService.getBookingData (visibility outputs)', () => {
  function makeBookingData(over: Record<string, unknown> = {}) {
    return {
      id: bookingId,
      userId,
      date: new Date('2026-08-15'),
      fee: 1000,
      title: 'Wedding',
      status: 'PROVISIONAL',
      customer: { name: 'Test Client', greetingName: null },
      venue: { name: 'Test Venue' },
      sets: [],
      packages: [],
      invoices: [],
      contracts: [],
      documents: [],
      musicFormConfig: null,
      musicFormResponse: null,
      ...over,
    };
  }

  function makeService(bookingOver: Record<string, unknown> = {}) {
    return new PortalService(
      { findBookingByToken: jest.fn().mockResolvedValue(makeBookingData(bookingOver)) } as unknown as import('./portal.repository').PortalRepository,
      { findByUserId: jest.fn().mockResolvedValue(publicProfile) } as unknown as import('../user-profile/public-profile.repository').PublicProfileRepository,
      {} as unknown as import('../songs/songs.repository').SongsRepository,
      {} as unknown as import('../invoices/invoices.repository').InvoicesRepository,
      {} as unknown as import('../mail/mail.service').MailService,
      {} as unknown as DocumentsService,
      { getPublicUrl: jest.fn().mockReturnValue('https://example.com/doc.pdf') } as unknown as StorageService,
      {} as unknown as import('../checklist/checklist-evaluator.service').ChecklistEvaluatorService,
      {} as unknown as import('../bookings/contract.repository').ContractRepository,
      {} as unknown as import('../bookings/music-form-config.repository').MusicFormConfigRepository,
    );
  }

  it.each([
    ['DRAFT', null],
    ['SENT', 'SENT'],
    ['SIGNED', 'SIGNED'],
    ['VOID', null],
  ])('exposes contractStatus for a %s contract as %s', async (status, expected) => {
    const service = makeService({ contracts: [{ id: contractId, status }] });
    const result = await service.getBookingData(token);
    expect(result.contractStatus).toBe(expected);
  });

  it('exposes contractStatus null when there is no contract', async () => {
    const service = makeService({ contracts: [] });
    const result = await service.getBookingData(token);
    expect(result.contractStatus).toBeNull();
  });

  // #533: hasMusicForm gates on *published*, not mere config existence. A draft (unpublished) form
  // reads false — the client sees no link.
  it('sets hasMusicForm true only when the music form config is published', async () => {
    const published = await makeService({
      musicFormConfig: { id: 'mfc1', publishedAt: new Date() },
    }).getBookingData(token);
    const draft = await makeService({
      musicFormConfig: { id: 'mfc1', publishedAt: null },
    }).getBookingData(token);
    const off = await makeService({ musicFormConfig: null }).getBookingData(token);
    expect(published.hasMusicForm).toBe(true);
    expect(draft.hasMusicForm).toBe(false);
    expect(off.hasMusicForm).toBe(false);
  });

  // #579 leak fixes: UPLOAD documents are never client-visible, and a cancelled booking hides the
  // whole contract concern (status, signed download, contract doc row) while keeping other docs.
  function doc(over: Record<string, unknown>) {
    return { id: 'd', storageKey: 'k', createdAt: new Date('2026-07-01'), ...over };
  }
  const contractDoc = doc({ id: 'dc', type: 'CONTRACT', contractId: 'c1' });
  const invoiceDoc = doc({
    id: 'di',
    type: 'INVOICE',
    invoice: { status: 'SENT', invoiceNumber: 'INV-1', isDeposit: false },
  });
  const uploadDoc = doc({ id: 'du', type: 'UPLOAD' });

  it('excludes UPLOAD documents from the portal, keeping other visible documents (#579)', async () => {
    const service = makeService({ documents: [uploadDoc, invoiceDoc] });
    const result = await service.getBookingData(token);
    const types = result.documents.map((d) => d.type);
    expect(types).toEqual(['INVOICE']);
  });

  it.each(['SENT', 'SIGNED'])(
    'hides the whole contract concern on a cancelled booking with a %s contract (#579)',
    async (contractStatus) => {
      const service = makeService({
        status: 'CANCELLED',
        contracts: [{ id: 'c1', status: contractStatus }],
        documents: [contractDoc, invoiceDoc],
      });
      const result = await service.getBookingData(token);

      expect(result.contractStatus).toBeNull();
      expect(result.signedContractUrl).toBeNull();
      // Contract doc row is dropped; the unrelated invoice document is untouched.
      expect(result.documents.map((d) => d.type)).toEqual(['INVOICE']);
    },
  );

  it('keeps the contract concern visible on a non-cancelled booking with a SENT contract', async () => {
    const service = makeService({
      status: 'PROVISIONAL',
      contracts: [{ id: 'c1', status: 'SENT' }],
      documents: [contractDoc, invoiceDoc],
    });
    const result = await service.getBookingData(token);

    expect(result.contractStatus).toBe('SENT');
    expect(result.signedContractUrl).not.toBeNull();
    expect(result.documents.map((d) => d.type)).toEqual(['CONTRACT', 'INVOICE']);
  });
});
