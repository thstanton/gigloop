import { NotFoundException } from '@nestjs/common';
import { MailService, EmailContext, SeriesEmailContext } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { BUILT_IN_EMAIL_TYPES, TEMPLATE_DEFAULT_SUBJECTS, VARIABLE_FALLBACKS, getDefaultContent } from '../templates/default-templates';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email-id' }) },
    batch: { send: jest.fn().mockResolvedValue({ data: [] }) },
  })),
}));

const mockPrisma = {
  booking: { findFirst: jest.fn() },
  bookingSeries: { findFirst: jest.fn() },
  publicProfile: { findUnique: jest.fn() },
  invoice: { findFirst: jest.fn() },
  invoiceLineItem: { findMany: jest.fn() },
  communication: { create: jest.fn(), update: jest.fn() },
};

const booking = {
  id: 'b1',
  userId: 'u1',
  date: new Date('2025-08-15'),
  fee: { valueOf: () => 2500, toFixed: undefined } as unknown as number,
  portalToken: 'tok-abc',
  customer: { name: 'Jane Doe' },
  venue: { name: 'The Grand Hotel' },
  sets: [
    { order: 1, startTime: '14:00', label: 'Ceremony', duration: 30 },
    { order: 2, startTime: null, label: null, duration: 45 },
  ],
};

const series = {
  id: 's1',
  userId: 'u1',
  label: 'Hotel Intercontinental — May 2026',
  customer: { name: 'Hotel Intercontinental', greetingName: 'Priya' },
};

// Line items as buildSeriesDatesCovered selects them: the source booking, or null for a
// hand-added line (which the query already filters out).
const seriesLines = [
  { sourceBooking: { id: 'b1', date: new Date('2026-05-01') } },
  { sourceBooking: { id: 'b2', date: new Date('2026-05-29') } },
  { sourceBooking: { id: 'b3', date: new Date('2026-05-15') } },
];

const publicProfile = {
  displayName: 'Tim Stanton',
  businessName: 'Tim Stanton Music',
  email: 'tim@example.com',
};

const fullContext: EmailContext = {
  customerName: 'Jane Doe',
  greetingName: 'Jane',
  bookingDate: '2025-08-15',
  venueName: 'The Grand Hotel',
  bookingFee: '£2500.00',
  setsSchedule: '<ul><li>Ceremony</li></ul>',
  musicianName: 'Tim Stanton',
  musicianEmail: 'tim@example.com',
  portalLink: 'https://app.gigman.com/booking/tok-abc',
  issueDate: '2025-06-01',
  invoiceTotal: '£750.00',
  invoiceDueDate: '2025-07-01',
};

const fullSeriesContext: SeriesEmailContext = {
  customerName: 'Hotel Intercontinental',
  greetingName: 'Priya',
  seriesLabel: 'Hotel Intercontinental — May 2026',
  datesCovered: '3 dates from 2026-05-01 to 2026-05-29',
  musicianName: 'Tim Stanton',
  musicianEmail: 'tim@example.com',
  issueDate: '2026-06-01',
  invoiceTotal: '£1800.00',
  invoiceDueDate: '2026-06-15',
};

function makeService(): MailService {
  return new MailService(mockPrisma as unknown as PrismaService);
}

function varContent(varName: string): unknown {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: `{{${varName}}}` }] }],
  };
}

describe('MailService', () => {
  let service: MailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  // ─── buildContext ─────────────────────────────────────────────────────────────

  describe('buildContext', () => {
    beforeEach(() => {
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockPrisma.publicProfile.findUnique.mockResolvedValue(publicProfile);
    });

    it('maps booking and profile fields to context correctly', async () => {
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.customerName).toBe('Jane Doe');
      expect(ctx.bookingDate).toBe('2025-08-15');
      expect(ctx.venueName).toBe('The Grand Hotel');
      expect(ctx.musicianName).toBe('Tim Stanton');
      expect(ctx.musicianEmail).toBe('tim@example.com');
      expect(ctx.portalLink).toContain('tok-abc');
    });

    it('falls back to businessName when displayName is null', async () => {
      mockPrisma.publicProfile.findUnique.mockResolvedValue({ ...publicProfile, displayName: null });
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.musicianName).toBe('Tim Stanton Music');
    });

    it('returns empty strings for missing venue and fee', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ ...booking, venue: null, fee: null });
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.venueName).toBe('');
      expect(ctx.bookingFee).toBe('');
    });

    it('renders sets schedule as newline-separated plain text', async () => {
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.setsSchedule).not.toContain('<');
      expect(ctx.setsSchedule).toContain('Ceremony');
      expect(ctx.setsSchedule).toContain('30 min');
      expect(ctx.setsSchedule).toContain('\n');
    });

    it('uses start time prefix when set is timed', async () => {
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.setsSchedule).toContain('14:00');
    });

    it('omits time prefix for untimed sets', async () => {
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.setsSchedule).toContain('Set (45 min)');
    });

    it('returns empty setsSchedule when booking has no sets', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ ...booking, sets: [] });
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.setsSchedule).toBe('');
    });

    it('sums invoice line items for invoiceTotal', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        issueDate: new Date('2025-08-01'),
        dueDate: new Date('2025-09-01'),
        lineItems: [{ amount: '500.00' }, { amount: '1500.00' }],
      });
      const ctx = await service.buildContext('u1', 'b1', 'inv1');
      expect(ctx.invoiceTotal).toBe('£2000.00');
    });

    it('captures issueDate and invoiceDueDate from invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        issueDate: new Date('2025-08-01'),
        dueDate: new Date('2025-09-01'),
        lineItems: [],
      });
      const ctx = await service.buildContext('u1', 'b1', 'inv1');
      expect(ctx.issueDate).toBe('2025-08-01');
      expect(ctx.invoiceDueDate).toBe('2025-09-01');
    });

    it('leaves invoiceDueDate empty when invoice has no due date', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        issueDate: new Date('2025-08-01'),
        dueDate: null,
        lineItems: [{ amount: '500.00' }],
      });
      const ctx = await service.buildContext('u1', 'b1', 'inv1');
      expect(ctx.invoiceDueDate).toBe('');
    });

    it('leaves all invoice fields empty when no invoiceId provided', async () => {
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.issueDate).toBe('');
      expect(ctx.invoiceTotal).toBe('');
      expect(ctx.invoiceDueDate).toBe('');
    });

    it('leaves bookingDate empty when booking.date is null', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue({ ...booking, date: null });
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.bookingDate).toBe('');
    });

    it('formats bookingFee with £ symbol', async () => {
      const ctx = await service.buildContext('u1', 'b1');
      expect(ctx.bookingFee).toMatch(/^£\d+\.\d{2}$/);
    });

    it('formats invoiceTotal with £ symbol', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        issueDate: new Date('2025-08-01'),
        dueDate: null,
        lineItems: [{ amount: '360.00' }],
      });
      const ctx = await service.buildContext('u1', 'b1', 'inv1');
      expect(ctx.invoiceTotal).toBe('£360.00');
    });

    it('throws NotFoundException when booking is not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      await expect(service.buildContext('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when public profile does not exist', async () => {
      mockPrisma.publicProfile.findUnique.mockResolvedValue(null);
      await expect(service.buildContext('u1', 'b1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── buildSeriesContext (#846) ────────────────────────────────────────────────

  describe('buildSeriesContext', () => {
    beforeEach(() => {
      mockPrisma.bookingSeries.findFirst.mockResolvedValue(series);
      mockPrisma.publicProfile.findUnique.mockResolvedValue(publicProfile);
      mockPrisma.invoiceLineItem.findMany.mockResolvedValue(seriesLines);
      mockPrisma.invoice.findFirst.mockResolvedValue({
        issueDate: new Date('2026-06-01'),
        dueDate: new Date('2026-06-15'),
        lineItems: [{ amount: '600.00' }, { amount: '1200.00' }],
      });
    });

    it('addresses the series customer, not any member booking customer', async () => {
      const ctx = await service.buildSeriesContext('u1', 's1');
      expect(ctx.customerName).toBe('Hotel Intercontinental');
      expect(ctx.greetingName).toBe('Priya');
    });

    it('falls back to the customer name when greetingName is null', async () => {
      mockPrisma.bookingSeries.findFirst.mockResolvedValue({
        ...series,
        customer: { name: 'Hotel Intercontinental', greetingName: null },
      });
      const ctx = await service.buildSeriesContext('u1', 's1');
      expect(ctx.greetingName).toBe('Hotel Intercontinental');
    });

    it('names the series', async () => {
      const ctx = await service.buildSeriesContext('u1', 's1');
      expect(ctx.seriesLabel).toBe('Hotel Intercontinental — May 2026');
    });

    it('scopes the series lookup to the tenant', async () => {
      await service.buildSeriesContext('u1', 's1');
      expect(mockPrisma.bookingSeries.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's1', userId: 'u1' } }),
      );
    });

    it('carries no booking-shaped variables', async () => {
      const ctx = await service.buildSeriesContext('u1', 's1');
      expect(Object.keys(ctx)).not.toContain('bookingDate');
      expect(Object.keys(ctx)).not.toContain('venueName');
      expect(Object.keys(ctx)).not.toContain('portalLink');
    });

    it('summarises datesCovered as a count and a range, in date order', async () => {
      const ctx = await service.buildSeriesContext('u1', 's1', 'inv1');
      expect(ctx.datesCovered).toBe('3 dates from 2026-05-01 to 2026-05-29');
    });

    it('reads datesCovered from the invoice line items, scoped to the tenant and the series', async () => {
      await service.buildSeriesContext('u1', 's1', 'inv1');
      expect(mockPrisma.invoiceLineItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'u1',
            invoiceId: 'inv1',
            invoice: { seriesId: 's1' },
            sourceBookingId: { not: null },
          },
        }),
      );
    });

    it('counts a booking once when several lines trace to it', async () => {
      mockPrisma.invoiceLineItem.findMany.mockResolvedValue([
        { sourceBooking: { id: 'b1', date: new Date('2026-05-01') } },
        { sourceBooking: { id: 'b1', date: new Date('2026-05-01') } },
        { sourceBooking: { id: 'b2', date: new Date('2026-05-08') } },
      ]);
      const ctx = await service.buildSeriesContext('u1', 's1', 'inv1');
      expect(ctx.datesCovered).toBe('2 dates from 2026-05-01 to 2026-05-08');
    });

    it('renders a single covered date as the date itself', async () => {
      mockPrisma.invoiceLineItem.findMany.mockResolvedValue([
        { sourceBooking: { id: 'b1', date: new Date('2026-05-01') } },
      ]);
      const ctx = await service.buildSeriesContext('u1', 's1', 'inv1');
      expect(ctx.datesCovered).toBe('2026-05-01');
    });

    it('leaves datesCovered empty for an invoice of purely hand-added lines', async () => {
      mockPrisma.invoiceLineItem.findMany.mockResolvedValue([]);
      const ctx = await service.buildSeriesContext('u1', 's1', 'inv1');
      expect(ctx.datesCovered).toBe('');
    });

    it('sums the invoice line items for invoiceTotal', async () => {
      const ctx = await service.buildSeriesContext('u1', 's1', 'inv1');
      expect(ctx.invoiceTotal).toBe('£1800.00');
      expect(ctx.issueDate).toBe('2026-06-01');
      expect(ctx.invoiceDueDate).toBe('2026-06-15');
    });

    it('resolves the invoice by its series owner, never by a booking', async () => {
      await service.buildSeriesContext('u1', 's1', 'inv1');
      expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv1', userId: 'u1', seriesId: 's1' } }),
      );
    });

    it('honours the issue and due date overrides used for draft previews', async () => {
      const ctx = await service.buildSeriesContext('u1', 's1', 'inv1', '2026-07-01', '2026-07-15');
      expect(ctx.issueDate).toBe('2026-07-01');
      expect(ctx.invoiceDueDate).toBe('2026-07-15');
    });

    it('leaves every invoice field empty when no invoiceId is provided', async () => {
      const ctx = await service.buildSeriesContext('u1', 's1');
      expect(ctx.issueDate).toBe('');
      expect(ctx.invoiceTotal).toBe('');
      expect(ctx.invoiceDueDate).toBe('');
      expect(ctx.datesCovered).toBe('');
      expect(mockPrisma.invoiceLineItem.findMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the series is not found', async () => {
      mockPrisma.bookingSeries.findFirst.mockResolvedValue(null);
      await expect(service.buildSeriesContext('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the public profile does not exist', async () => {
      mockPrisma.publicProfile.findUnique.mockResolvedValue(null);
      await expect(service.buildSeriesContext('u1', 's1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── renderTemplate ───────────────────────────────────────────────────────────

  describe('renderTemplate', () => {
    const emptyContext: EmailContext = {
      customerName: '', greetingName: '', bookingDate: '', venueName: '', bookingFee: '',
      setsSchedule: '', musicianName: '', musicianEmail: '', portalLink: '',
      issueDate: '', invoiceTotal: '', invoiceDueDate: '',
    };

    // All 11 variables substituted when present
    const allVariables: Array<keyof EmailContext> = [
      'customerName', 'bookingDate', 'venueName', 'bookingFee',
      'setsSchedule', 'musicianName', 'musicianEmail', 'portalLink',
      'issueDate', 'invoiceTotal', 'invoiceDueDate',
    ];

    // Every fixture value here is free of HTML-special characters, so it escapes
    // to itself — these rendered bodies are byte-identical before and after the
    // #689 escaping change. setsSchedule is excluded: it is inherently multi-line
    // and its fixture holds markup, so it gets its own escaped-output test below.
    for (const varName of allVariables.filter((v) => v !== 'setsSchedule')) {
      it(`substitutes {{${varName}}} when value is present`, () => {
        const { html, missingVariables } = service.renderTemplate(varContent(varName), fullContext);
        expect(html).toBe(`<p>${fullContext[varName]}</p>`);
        expect(missingVariables).not.toContain(varName);
      });
    }

    // #689: values now HTML-escaped — injection fix
    it('HTML-escapes markup in substituted values (was injected raw into the body)', () => {
      const { html } = service.renderTemplate(varContent('customerName'), {
        ...fullContext,
        customerName: '<script>alert(1)</script>',
      });
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    // #689: values now HTML-escaped — injection fix
    it('escapes markup in setsSchedule when present (previously passed through unescaped)', () => {
      const { html, missingVariables } = service.renderTemplate(varContent('setsSchedule'), fullContext);
      expect(html).toBe('<p>&lt;ul&gt;&lt;li&gt;Ceremony&lt;/li&gt;&lt;/ul&gt;</p>');
      expect(missingVariables).not.toContain('setsSchedule');
    });

    // All variables reported as missing when empty
    for (const varName of allVariables) {
      it(`reports {{${varName}}} as missing when empty`, () => {
        const { missingVariables } = service.renderTemplate(
          varContent(varName),
          { ...fullContext, [varName]: '' },
        );
        expect(missingVariables).toContain(varName);
      });
    }

    // VARIABLE_FALLBACKS applied for the three special variables
    it('substitutes bookingDate fallback "your event" when empty', () => {
      const { html } = service.renderTemplate(varContent('bookingDate'), { ...fullContext, bookingDate: '' });
      expect(html).toBe('<p>your event</p>');
    });

    it('substitutes venueName fallback "the venue" when empty', () => {
      const { html } = service.renderTemplate(varContent('venueName'), { ...fullContext, venueName: '' });
      expect(html).toBe('<p>the venue</p>');
    });

    it('substitutes customerName fallback "your client" when empty', () => {
      const { html } = service.renderTemplate(varContent('customerName'), { ...fullContext, customerName: '' });
      expect(html).toBe('<p>your client</p>');
    });

    // Variables without fallbacks produce empty string
    it('produces empty string for invoiceTotal when missing (no fallback)', () => {
      const { html } = service.renderTemplate(varContent('invoiceTotal'), { ...fullContext, invoiceTotal: '' });
      expect(html).toBe('<p></p>');
    });

    it('produces empty string for invoiceDueDate when missing (no fallback)', () => {
      const { html } = service.renderTemplate(varContent('invoiceDueDate'), { ...fullContext, invoiceDueDate: '' });
      expect(html).toBe('<p></p>');
    });

    it('produces empty string for issueDate when missing (no fallback)', () => {
      const { html } = service.renderTemplate(varContent('issueDate'), { ...fullContext, issueDate: '' });
      expect(html).toBe('<p></p>');
    });

    // Multiple missing variables
    it('reports all missing variables when multiple are empty', () => {
      const ctx = { ...fullContext, bookingDate: '', invoiceTotal: '', venueName: '' };
      const content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: '{{bookingDate}} at {{venueName}} — {{invoiceTotal}}' },
        ]}],
      };
      const { missingVariables } = service.renderTemplate(content, ctx);
      expect(missingVariables).toContain('bookingDate');
      expect(missingVariables).toContain('venueName');
      expect(missingVariables).toContain('invoiceTotal');
    });

    // Deduplication
    it('deduplicates missingVariables when the same variable appears twice', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: '{{bookingDate}} and again {{bookingDate}}' },
        ]}],
      };
      const { missingVariables } = service.renderTemplate(content, { ...fullContext, bookingDate: '' });
      expect(missingVariables.filter((v) => v === 'bookingDate')).toHaveLength(1);
    });

    // Unknown variable
    it('produces empty string and reports unknown variables', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '{{unknownVar}}' }] }],
      };
      const { html, missingVariables } = service.renderTemplate(content, fullContext);
      expect(html).toBe('<p></p>');
      expect(missingVariables).toContain('unknownVar');
    });

    // Full context — no missing variables
    it('returns empty missingVariables when all variables are present', () => {
      const content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: '{{customerName}} {{bookingDate}} {{musicianName}}' },
        ]}],
      };
      const { missingVariables } = service.renderTemplate(content, fullContext);
      expect(missingVariables).toHaveLength(0);
    });

    // Empty template
    it('handles an empty document without errors', () => {
      const { html, missingVariables } = service.renderTemplate({ type: 'doc', content: [] }, emptyContext);
      expect(html).toBe('');
      expect(missingVariables).toHaveLength(0);
    });
  });

  // ─── renderTemplate with a series context (#846) ──────────────────────────────

  describe('renderTemplate with a series context', () => {
    it('substitutes series variables into the body', () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Invoice for ' },
              { type: 'variable', attrs: { name: 'seriesLabel' } },
              { type: 'text', text: ' covering ' },
              { type: 'variable', attrs: { name: 'datesCovered' } },
            ],
          },
        ],
      };
      const { html, missingVariables } = service.renderTemplate(content, fullSeriesContext);
      expect(html).toContain('Hotel Intercontinental');
      expect(html).toContain('3 dates from 2026-05-01 to 2026-05-29');
      expect(missingVariables).toHaveLength(0);
    });

    it('renders the shipped series_invoice_cover default without any unresolved variable', () => {
      const content = getDefaultContent('series_invoice_cover');
      const { html, missingVariables } = service.renderTemplate(content, fullSeriesContext);
      expect(html).not.toContain('{{');
      expect(html).toContain('Hotel Intercontinental — May 2026');
      expect(missingVariables).toHaveLength(0);
    });
  });

  // ─── renderSubject ────────────────────────────────────────────────────────────

  describe('renderSubject', () => {
    it('returns empty string for null builtInType', () => {
      const { subject } = service.renderSubject(null, fullContext);
      expect(subject).toBe('');
    });

    it('returns empty string for unknown builtInType', () => {
      const { subject } = service.renderSubject('some_unknown_type', fullContext);
      expect(subject).toBe('');
    });

    // Static subjects (no variables) — should always succeed with no missing
    it('contract_received produces static subject', () => {
      const { subject, missingVariables } = service.renderSubject('contract_received', fullContext);
      expect(subject).toBe('Contract received — thank you');
      expect(missingVariables).toHaveLength(0);
    });

    it('deposit_received produces static subject', () => {
      const { subject, missingVariables } = service.renderSubject('deposit_received', fullContext);
      expect(subject).toBe('Deposit received — thank you');
      expect(missingVariables).toHaveLength(0);
    });

    it('thank_you produces static subject', () => {
      const { subject, missingVariables } = service.renderSubject('thank_you', fullContext);
      expect(subject).toBe('Thank you — it was a pleasure');
      expect(missingVariables).toHaveLength(0);
    });

    // Variable subjects — substituted correctly
    it('quote substitutes musicianName', () => {
      const { subject } = service.renderSubject('quote', fullContext);
      expect(subject).toBe('Your quote from Tim Stanton');
    });

    it('confirmation substitutes bookingDate', () => {
      const { subject } = service.renderSubject('confirmation', fullContext);
      expect(subject).toBe('Booking confirmation — 2025-08-15');
    });

    it('contract_cover substitutes bookingDate', () => {
      const { subject } = service.renderSubject('contract_cover', fullContext);
      expect(subject).toBe('Your contract — 2025-08-15');
    });

    it('contract_and_deposit_cover substitutes bookingDate', () => {
      const { subject } = service.renderSubject('contract_and_deposit_cover', fullContext);
      expect(subject).toBe('Your contract and deposit invoice — 2025-08-15');
    });

    it('deposit_invoice_cover substitutes bookingDate', () => {
      const { subject } = service.renderSubject('deposit_invoice_cover', fullContext);
      expect(subject).toBe('Your deposit invoice — 2025-08-15');
    });

    // Rendering with a series-shaped context (#846). The it.each coverage case below only
    // proves a subject exists; these prove the series context actually reaches the output.
    it('series_invoice_cover substitutes the series label', () => {
      const { subject, missingVariables } = service.renderSubject('series_invoice_cover', fullSeriesContext);
      expect(subject).toBe('Your invoice for Hotel Intercontinental — May 2026');
      expect(missingVariables).toHaveLength(0);
    });

    it('falls back and reports the series label as missing when it is empty', () => {
      const { subject, missingVariables } = service.renderSubject('series_invoice_cover', {
        ...fullSeriesContext,
        seriesLabel: '',
      });
      expect(subject).toBe('Your invoice for your booking series');
      expect(missingVariables).toContain('seriesLabel');
    });

    it('reports a booking variable as missing when a booking template is given a series context', () => {
      const { missingVariables } = service.renderSubject('balance_invoice_cover', fullSeriesContext);
      expect(missingVariables).toContain('bookingDate');
    });

    it('balance_invoice_cover substitutes bookingDate', () => {
      const { subject } = service.renderSubject('balance_invoice_cover', fullContext);
      expect(subject).toBe('Your balance invoice — 2025-08-15');
    });

    it('music_form_invite substitutes bookingDate', () => {
      const { subject } = service.renderSubject('music_form_invite', fullContext);
      expect(subject).toBe('Your music request form — 2025-08-15');
    });

    // Missing variables in subjects
    it('falls back to "your event" when bookingDate is empty in a subject', () => {
      const { subject, missingVariables } = service.renderSubject('confirmation', { ...fullContext, bookingDate: '' });
      expect(subject).toBe('Booking confirmation — your event');
      expect(missingVariables).toContain('bookingDate');
    });

    it('reports musicianName missing when empty in quote subject', () => {
      const { subject, missingVariables } = service.renderSubject('quote', { ...fullContext, musicianName: '' });
      expect(subject).toBe('Your quote from ');
      expect(missingVariables).toContain('musicianName');
    });

    it('deduplicates missingVariables in subjects', () => {
      // bookingDate appears once in each subject — ensure no double-reporting
      const { missingVariables } = service.renderSubject('confirmation', { ...fullContext, bookingDate: '' });
      expect(missingVariables.filter((v) => v === 'bookingDate')).toHaveLength(1);
    });

    // All email template types have a defined default subject
    it.each(BUILT_IN_EMAIL_TYPES)(
      'has a defined default subject for built-in type "%s"',
      (type) => {
        const { subject } = service.renderSubject(type, fullContext);
        expect(subject.length).toBeGreaterThan(0);
      },
    );
  });

  // ─── VARIABLE_FALLBACKS coverage ─────────────────────────────────────────────

  describe('VARIABLE_FALLBACKS', () => {
    it('defines a fallback for bookingDate', () => {
      expect(VARIABLE_FALLBACKS['bookingDate']).toBe('your event');
    });

    it('defines a fallback for venueName', () => {
      expect(VARIABLE_FALLBACKS['venueName']).toBe('the venue');
    });

    it('defines a fallback for customerName', () => {
      expect(VARIABLE_FALLBACKS['customerName']).toBe('your client');
    });

    it('does not define a fallback for invoice variables', () => {
      expect(VARIABLE_FALLBACKS['invoiceTotal']).toBeUndefined();
      expect(VARIABLE_FALLBACKS['invoiceDueDate']).toBeUndefined();
      expect(VARIABLE_FALLBACKS['issueDate']).toBeUndefined();
    });
  });

  // ─── TEMPLATE_DEFAULT_SUBJECTS coverage ──────────────────────────────────────

  describe('TEMPLATE_DEFAULT_SUBJECTS', () => {
    it('covers all built-in email template types', () => {
      for (const type of BUILT_IN_EMAIL_TYPES) {
        expect(TEMPLATE_DEFAULT_SUBJECTS[type]).toBeDefined();
        expect(typeof TEMPLATE_DEFAULT_SUBJECTS[type]).toBe('string');
      }
    });
  });

  // ─── send ─────────────────────────────────────────────────────────────────────

  describe('send', () => {
    const sendOptions = {
      to: 'jane@example.com',
      subject: 'Your invoice',
      body: '<p>Dear Jane,</p>',
    };

    it('calls resend with the real recipient, subject and body', async () => {
      await service.send(sendOptions);
      const resendInstance = (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend;
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'jane@example.com', subject: 'Your invoice', html: '<p>Dear Jane,</p>' }),
      );
    });

    it('rethrows errors from Resend', async () => {
      const resendInstance = (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend;
      resendInstance.emails.send.mockRejectedValueOnce(new Error('Resend error'));
      await expect(service.send(sendOptions)).rejects.toThrow('Resend error');
    });

    it('passes attachments to Resend as base64 strings', async () => {
      const content = Buffer.from('pdf');
      await service.send({ ...sendOptions, attachments: [{ filename: 'inv.pdf', content }] });
      const resendInstance = (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend;
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({ attachments: [{ filename: 'inv.pdf', content: content.toString('base64') }] }),
      );
    });
  });

  // ─── MAIL_REDIRECT_TO (dev/preprod safety) ──────────────────────────────────────

  describe('MAIL_REDIRECT_TO', () => {
    const sendOptions = { to: 'jane@example.com', subject: 'Your invoice', body: '<p>Dear Jane,</p>' };

    afterEach(() => {
      delete process.env.MAIL_REDIRECT_TO;
    });

    it('redirects a single send to the override address when set', async () => {
      process.env.MAIL_REDIRECT_TO = 'sink@preprod.test';
      await service.send(sendOptions);
      const resendInstance = (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend;
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'sink@preprod.test' }),
      );
    });

    it('sends to the real recipient when the override is unset', async () => {
      delete process.env.MAIL_REDIRECT_TO;
      await service.send(sendOptions);
      const resendInstance = (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend;
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'jane@example.com' }),
      );
    });

    it('treats an empty override as unset (sends to the real recipient)', async () => {
      process.env.MAIL_REDIRECT_TO = '';
      await service.send(sendOptions);
      const resendInstance = (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend;
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'jane@example.com' }),
      );
    });

    it('redirects every recipient in a batch send when set', async () => {
      process.env.MAIL_REDIRECT_TO = 'sink@preprod.test';
      await service.sendBatch([
        { to: 'a@example.com', subject: 'A', body: '<p>A</p>' },
        { to: 'b@example.com', subject: 'B', body: '<p>B</p>' },
      ]);
      const resendInstance = (service as unknown as { resend: { batch: { send: jest.Mock } } }).resend;
      expect(resendInstance.batch.send).toHaveBeenCalledWith([
        expect.objectContaining({ to: 'sink@preprod.test', subject: 'A' }),
        expect.objectContaining({ to: 'sink@preprod.test', subject: 'B' }),
      ]);
    });

    it('sends a batch to real recipients when the override is unset', async () => {
      delete process.env.MAIL_REDIRECT_TO;
      await service.sendBatch([{ to: 'a@example.com', subject: 'A', body: '<p>A</p>' }]);
      const resendInstance = (service as unknown as { resend: { batch: { send: jest.Mock } } }).resend;
      expect(resendInstance.batch.send).toHaveBeenCalledWith([
        expect.objectContaining({ to: 'a@example.com' }),
      ]);
    });
  });
});
