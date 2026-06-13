/**
 * Integration tests for PortalService PDF flows — real pdfmake, mocked DB/storage/email.
 * Verifies font loading and PDF generation for signContract and submitMusicForm.
 */
import { PortalService } from './portal.service';
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
      { findBookingByToken: jest.fn().mockResolvedValue(booking) } as any,
      { findByUserId: jest.fn().mockResolvedValue(publicProfile) } as any,
      {} as any,
      { findDepositInvoice: jest.fn().mockResolvedValue(null) } as any,
      { buildContext: jest.fn().mockResolvedValue(emailContext), send: jest.fn().mockResolvedValue(undefined) } as any,
      documents,
      { getPublicUrl: jest.fn() } as any,
      { evaluate: jest.fn().mockResolvedValue(undefined) } as any,
      { markContractSigned: markContractSignedMock } as any,
      {} as any,
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
    musicFormConfig: { keyMoments: [], enabledGenres: ['Pop'] },
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
      { findMusicFormDataByToken: jest.fn().mockResolvedValue(bookingData) } as any,
      { findByUserId: jest.fn().mockResolvedValue(publicProfile) } as any,
      {
        findByIds: jest.fn().mockResolvedValue([song]),
        findAll: jest.fn().mockResolvedValue([song]),
      } as any,
      {} as any,
      { send: jest.fn().mockResolvedValue(undefined) } as any,
      documents,
      { getPublicUrl: jest.fn() } as any,
      { evaluate: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      {
        upsertMusicFormResponse: jest.fn().mockResolvedValue(undefined),
        findBookingForSongList: jest.fn().mockResolvedValue(bookingForSongList),
      } as any,
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
