import { join, dirname } from 'path';
import { createRequire } from 'module';
import { buildInvoiceDefinition, type InvoicePdfData } from './invoice-document';
import { buildSongListDefinition, type SongListPdfData } from './song-list-document';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfmake: any;

beforeAll(() => {
  const require_ = createRequire(__filename);
  pdfmake = require_('pdfmake');

  const fontDir = join(dirname(require_.resolve('pdfmake/package.json')), 'build/fonts/Roboto');
  const customFontsDir = join(dirname(__filename), 'fonts');

  pdfmake.addFonts({
    Roboto: {
      normal: join(fontDir, 'Roboto-Regular.ttf'),
      bold: join(fontDir, 'Roboto-Medium.ttf'),
      italics: join(fontDir, 'Roboto-Italic.ttf'),
      bolditalics: join(fontDir, 'Roboto-MediumItalic.ttf'),
    },
    Caveat: {
      normal: join(customFontsDir, 'Caveat-Regular.ttf'),
    },
    Commissioner: {
      normal: join(customFontsDir, 'Commissioner-Regular.ttf'),
      bold: join(customFontsDir, 'Commissioner-Medium.ttf'),
      italics: join(customFontsDir, 'Commissioner-Regular.ttf'),
      bolditalics: join(customFontsDir, 'Commissioner-Medium.ttf'),
    },
  });
  pdfmake.setLocalAccessPolicy(() => true);
});

const invoiceData: InvoicePdfData = {
  businessName: 'Test Musician',
  musicianName: 'Test Musician',
  email: 'test@example.com',
  address: null,
  bankDetails: null,
  vatNumber: null,
  vatRate: null,
  logoUrl: null,
  brandColour: '#1a1a1a',
  invoiceNumber: 'INV-001',
  issueDate: '2024-01-01',
  dueDate: null,
  isDeposit: false,
  clientName: 'Test Client',
  lineItems: [{ description: 'Wedding performance', amount: '1500.00' }],
  depositTotal: null,
};

const songListData: SongListPdfData = {
  musicianName: 'Test Musician',
  businessName: 'Test Musician',
  email: 'test@example.com',
  brandColour: '#1a1a1a',
  customerName: 'Test Client',
  bookingDate: '2024-06-01',
  venueName: null,
  specialRequests: [],
  selectedSongs: [
    { id: 's1', title: 'Perfect', artist: 'Ed Sheeran', genre: 'Pop' },
  ],
  notes: null,
  submittedAt: '2024-05-01 10:00:00 UTC',
};

describe('PDF generation', () => {
  it('generates invoice PDF using Commissioner + Caveat fonts', async () => {
    const docDef = buildInvoiceDefinition(invoiceData);
    const buffer: Buffer = await pdfmake.createPdf(docDef).getBuffer();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generates song list PDF using Commissioner + Caveat fonts', async () => {
    const docDef = buildSongListDefinition(songListData);
    const buffer: Buffer = await pdfmake.createPdf(docDef).getBuffer();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generates deposit invoice PDF', async () => {
    const depositData: InvoicePdfData = {
      ...invoiceData,
      invoiceNumber: 'DEP-001',
      isDeposit: true,
    };
    const docDef = buildInvoiceDefinition(depositData);
    const buffer: Buffer = await pdfmake.createPdf(docDef).getBuffer();
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
