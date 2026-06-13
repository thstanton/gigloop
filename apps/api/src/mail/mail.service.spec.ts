import { NotFoundException } from '@nestjs/common';
import { MailService, EmailContext } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { BUILT_IN_EMAIL_TYPES, TEMPLATE_DEFAULT_SUBJECTS, VARIABLE_FALLBACKS } from '../templates/default-templates';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email-id' }) },
  })),
}));

const mockPrisma = {
  booking: { findFirst: jest.fn() },
  publicProfile: { findUnique: jest.fn() },
  invoice: { findFirst: jest.fn() },
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

    for (const varName of allVariables) {
      it(`substitutes {{${varName}}} when value is present`, () => {
        const { html, missingVariables } = service.renderTemplate(varContent(varName), fullContext);
        expect(html).toBe(`<p>${fullContext[varName]}</p>`);
        expect(missingVariables).not.toContain(varName);
      });
    }

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

    it('calls resend with the provided subject and body', async () => {
      await service.send(sendOptions);
      const resendInstance = (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend;
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Your invoice', html: '<p>Dear Jane,</p>' }),
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
});
