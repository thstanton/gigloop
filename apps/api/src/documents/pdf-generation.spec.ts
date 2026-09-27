import { join, dirname } from 'path';
import { createRequire } from 'module';
import { buildInvoiceDefinition, type InvoicePdfData } from './invoice-document';
import { buildSongListDefinition, type SongListPdfData } from './song-list-document';
import { buildCallSheetDefinition, type CallSheetPdfData } from './call-sheet-document';

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
    PlayfairDisplay: {
      normal: join(customFontsDir, 'PlayfairDisplay-Medium.ttf'),
      bold: join(customFontsDir, 'PlayfairDisplay-SemiBold.ttf'),
      italics: join(customFontsDir, 'PlayfairDisplay-Medium.ttf'),
      bolditalics: join(customFontsDir, 'PlayfairDisplay-SemiBold.ttf'),
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

const callSheetData: CallSheetPdfData = {
  branding: {
    businessName: 'Test Musician',
    musicianName: 'Test Musician',
    email: 'test@example.com',
    phone: null,
    logoUrl: null,
    brandColour: '#1a1a1a',
  },
  bookingTitle: 'The Hartley Wedding',
  bookingDate: '2027-06-12T00:00:00.000Z',
  venueName: 'The Old Barn',
  venueAddress: { line1: '1 Barn Lane', line2: null, city: 'Hartley', county: null, postcode: 'HT1 1AA', country: null },
  segments: [
    { id: 'p1', label: 'Ceremony', icon: 'music', order: 0 },
    { id: 'p2', label: 'Evening Party', icon: 'music', order: 1 },
  ],
  chairs: [
    {
      id: 'chair-1',
      role: 'Vocals',
      memberName: 'Dave Smith',
      callTimes: [
        { segmentId: 'p1', segmentLabel: 'Ceremony', startTime: '13:00' },
        { segmentId: 'p2', segmentLabel: 'Evening Party', startTime: '20:00' },
      ],
    },
    {
      id: 'chair-2',
      role: 'Bass',
      memberName: null,
      callTimes: [{ segmentId: 'p2', segmentLabel: 'Evening Party', startTime: '20:00' }],
    },
  ],
  generatedAt: '27 Sep 2026, 14:32',
};

describe('PDF generation', () => {
  it('generates invoice PDF using Commissioner + PlayfairDisplay fonts', async () => {
    const docDef = buildInvoiceDefinition(invoiceData);
    const buffer: Buffer = await pdfmake.createPdf(docDef).getBuffer();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generates song list PDF using Commissioner + PlayfairDisplay fonts', async () => {
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

  it('generates call sheet PDF using Commissioner font', async () => {
    const docDef = buildCallSheetDefinition(callSheetData);
    const buffer: Buffer = await pdfmake.createPdf(docDef).getBuffer();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});

// Recursively collect every `text` string in a pdfmake definition node, so a rendered row can be
// asserted without a fragile positional path into the content tree.
function collectText(node: unknown): string[] {
  if (typeof node === 'string') return [];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (node && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    const here = typeof n.text === 'string' ? [n.text] : [];
    return [...here, ...Object.values(n).flatMap(collectText)];
  }
  return [];
}

// The render-time consumer of the invoiced-deposit rule (CONTEXT.md → Invoice → "Invoiced deposit —
// one rule, two consumers"): the "less deposit" deduction is driven by depositTotal, which the
// service derives from the active (non-VOID) deposit invoice. buildInvoiceDefinition is pure, so the
// deduction row and its gating are tested directly here.
describe('balance invoice deposit deduction', () => {
  it('renders a "Less deposit" row and the reduced balance when a deposit was invoiced', () => {
    const def = buildInvoiceDefinition({ ...invoiceData, depositTotal: '150.00' });
    const texts = collectText(def.content);
    expect(texts).toContain('Less deposit');
    expect(texts).toContain('-£150.00');
    expect(texts).toContain('£1350.00'); // 1500 subtotal − 150 deposit = 1350 balance due
  });

  it('renders no deduction row when there is no deposit (depositTotal null)', () => {
    const def = buildInvoiceDefinition({ ...invoiceData, depositTotal: null });
    const texts = collectText(def.content);
    expect(texts).not.toContain('Less deposit');
    expect(texts).toContain('£1500.00'); // full total due, no deduction
  });
});

// The letterhead is assembled by the shared buildPdfHeader, so a field can be present on
// InvoicePdfData, computed by the service, and still never reach the page if the call site stops
// passing it — which is exactly how the business address and VAT number were silently dropped in the
// PDF redesign (0e170b6). These assert the rendered rows, not the call signature.
describe('invoice letterhead', () => {
  const withLetterhead: InvoicePdfData = {
    ...invoiceData,
    address: '12 Example Street\nSuite 4\nLondon\nSW1A 1AA',
    vatNumber: 'GB123456789',
  };

  it('renders every business address line', () => {
    const texts = collectText(buildInvoiceDefinition(withLetterhead).content);
    expect(texts).toContain('12 Example Street');
    expect(texts).toContain('Suite 4');
    expect(texts).toContain('London');
    expect(texts).toContain('SW1A 1AA');
  });

  it('renders the VAT registration number', () => {
    const texts = collectText(buildInvoiceDefinition(withLetterhead).content);
    expect(texts).toContain('VAT: GB123456789');
  });

  it('omits both rows when the profile has neither', () => {
    const texts = collectText(buildInvoiceDefinition(invoiceData).content);
    expect(texts).not.toContain('12 Example Street');
    expect(texts.some((t) => t.startsWith('VAT: '))).toBe(false);
  });
});

// #893 (ADR-0073 §4): the call sheet is forwardable, so no fee may ever appear on it —
// `CallSheetPdfData`'s `chairs` field (`BandPortalRosterChair[]`) structurally has no fee, but this
// asserts the rendered page too, since a structural guarantee on the input type says nothing about
// what a future change to this builder might add to the content tree.
describe('call sheet (#893, ADR-0073 §4)', () => {
  it('never renders a currency amount anywhere on the page', () => {
    const texts = collectText(buildCallSheetDefinition(callSheetData).content);
    expect(texts.some((t) => t.includes('£'))).toBe(false);
  });

  it('renders one column per segment, with each chair\'s call time in the right column', () => {
    const texts = collectText(buildCallSheetDefinition(callSheetData).content);
    expect(texts).toContain('Ceremony');
    expect(texts).toContain('Evening Party');
    expect(texts).toContain('13:00');
    expect(texts).toContain('20:00');
  });

  it('renders a vacant chair role-only, never a placeholder name', () => {
    const texts = collectText(buildCallSheetDefinition(callSheetData).content);
    expect(texts).toContain('Bass');
    expect(texts).toContain('Vacant');
  });

  it('self-dates the footer with the generation timestamp and the check-your-portal line', () => {
    const def = buildCallSheetDefinition(callSheetData);
    const footer =
      typeof def.footer === 'function'
        ? def.footer(1, 1, { width: 595, height: 842, orientation: 'portrait' })
        : def.footer;
    const texts = collectText(footer);
    expect(texts).toContain('Generated 27 Sep 2026, 14:32 — check your portal');
  });

  it('falls back to a single "Call time" column for a package-less booking', () => {
    const packageLess: CallSheetPdfData = {
      ...callSheetData,
      segments: [],
      chairs: [
        { id: 'chair-1', role: 'Vocals', memberName: 'Dave Smith', callTimes: [{ segmentId: null, segmentLabel: null, startTime: '18:00' }] },
      ],
    };
    const texts = collectText(buildCallSheetDefinition(packageLess).content);
    expect(texts).toContain('Call time');
    expect(texts).toContain('18:00');
  });
});
