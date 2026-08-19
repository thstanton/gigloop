import { Injectable, NotFoundException } from '@nestjs/common';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { renderTiptap } from './tiptap.renderer';
import { resolveVar, substituteTiptapVariables } from './tiptap-substitute';
import { TEMPLATE_DEFAULT_SUBJECTS } from '../templates/default-templates';

// What every template context supplies regardless of what the email is about: who it is
// addressed to, who it is from, and the invoice figures when one is attached.
export type BaseEmailContext = {
  customerName: string;
  greetingName: string;
  musicianName: string;
  musicianEmail: string;
  issueDate: string;
  invoiceTotal: string;
  invoiceDueDate: string;
};

// Booking-shaped context — one event, one date, one venue, one portal link.
export type EmailContext = BaseEmailContext & {
  bookingDate: string;
  venueName: string;
  bookingFee: string;
  setsSchedule: string;
  portalLink: string;
};

// Series-shaped context (#846). A series invoice bills the *series* customer for many dates,
// so there is no single bookingDate/venue/portal link to offer — reaching for one is the bug
// this shape exists to prevent. See CONTEXT.md → BookingSeries.
export type SeriesEmailContext = BaseEmailContext & {
  seriesLabel: string;
  datesCovered: string;
};

// Either shape may be rendered: substitution resolves by variable name, and a name the
// context does not carry falls through VARIABLE_FALLBACKS and is reported as missing.
export type TemplateContext = EmailContext | SeriesEmailContext;

const EMPTY_INVOICE_CONTEXT = { issueDate: '', invoiceTotal: '', invoiceDueDate: '' };

export interface RenderResult {
  html: string;
  missingVariables: string[];
}

/** What a compose surface needs to seed its editable subject + body from a template. */
export interface ComposeRender {
  subject: string;
  body: string;
  missingVariables: string[];
}

/** The two template fields a compose render reads — narrower than the Prisma Template row. */
export interface RenderableTemplate {
  content: unknown;
  builtInType: string | null;
}

export interface SenderIdentity {
  name: string;
  email: string;
}

export interface MailTransportOptions {
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  /** Client-facing sends only (#932) — personalizes From/Reply-To with the musician's identity. */
  senderIdentity?: SenderIdentity;
}

type SetRow = { startTime: string | null; label: string | null; duration: number };

function buildSetsSchedule(sets: SetRow[]): string {
  if (sets.length === 0) return '';
  return sets
    .map((s) => {
      const time = s.startTime ? `${s.startTime} — ` : '';
      return `${time}${s.label ?? 'Set'} (${s.duration} min)`;
    })
    .join('\n');
}

// Summarises the dates a series invoice bills for. ISO dates, matching `bookingDate`'s
// format so the two never read differently in the same inbox. No dates (an invoice of purely
// hand-added lines) yields '' — which reports as a missing variable and falls back, exactly
// as an absent bookingDate does.
function buildDatesCovered(dates: Date[]): string {
  const iso = [...new Set(dates.map((d) => d.toISOString().split('T')[0]))].sort((a, b) => a.localeCompare(b));
  if (iso.length === 0) return '';
  if (iso.length === 1) return iso[0];
  return `${iso.length} dates from ${iso[0]} to ${iso[iso.length - 1]}`;
}

@Injectable()
export class MailService {
  private _resend?: Resend;

  constructor(private prisma: PrismaService) {}

  // Constructed lazily on first use, not in the constructor: the `resend` SDK
  // throws from its own constructor when the API key is missing, and the
  // E2E_TEST_MODE sink (SinkMailService) extends this class and calls super().
  // Eager init therefore crashed the test-mode API at boot (no RESEND_API_KEY).
  // The sink overrides send/sendBatch — the only callers — so it never triggers
  // this getter and boots cleanly.
  private get resend(): Resend {
    if (!this._resend) {
      this._resend = new Resend(process.env.RESEND_API_KEY);
    }
    return this._resend;
  }

  // #681: single override for every outbound recipient. When MAIL_REDIRECT_TO is set
  // (dev/preprod), all mail is redirected there so the synthetic-data smoke-test env can
  // never email a real customer. Unset (prod) → the real recipient. Applied to BOTH send()
  // and sendBatch() so the two outbound paths never diverge again — sendBatch previously
  // used the real recipient while send() was hardcoded to a personal address.
  private resolveRecipient(to: string): string {
    return process.env.MAIL_REDIRECT_TO || to;
  }

  // #932: lightweight identity lookup for client-facing sends — same fallback chain as
  // buildContext's musicianName/musicianEmail, but standalone since the series-invoice send
  // path has no bookingId to build a full EmailContext from. Never throws: a missing/blank
  // profile just means the caller's send() falls back to the generic default.
  async getSenderIdentity(userId: string): Promise<SenderIdentity> {
    const publicProfile = await this.prisma.publicProfile.findUnique({ where: { userId } });
    return {
      name: publicProfile?.displayName ?? publicProfile?.businessName ?? '',
      email: publicProfile?.email ?? '',
    };
  }

  // `owner` is the invoice's owner FK — a booking or a series (ADR-0029: one polymorphic
  // Invoice). It is part of the where clause, not just userId, so an invoice id belonging to
  // a different booking/series can never leak its figures into someone else's cover email.
  private async buildInvoiceContext(
    invoiceId: string,
    owner: { bookingId: string } | { seriesId: string },
    userId: string,
    issueDateOverride?: string,
    dueDateOverride?: string,
  ): Promise<{ issueDate: string; invoiceTotal: string; invoiceDueDate: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId, ...owner },
      include: { lineItems: true },
    });
    if (!invoice) return EMPTY_INVOICE_CONTEXT;

    const total = invoice.lineItems.reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      issueDate: issueDateOverride ?? (invoice.issueDate ? invoice.issueDate.toISOString().split('T')[0] : ''),
      invoiceTotal: `£${total.toFixed(2)}`,
      invoiceDueDate: dueDateOverride ?? (invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : ''),
    };
  }

  async buildContext(
    userId: string,
    bookingId: string,
    invoiceId?: string,
    issueDateOverride?: string,
    dueDateOverride?: string,
  ): Promise<EmailContext> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: {
        customer: true,
        venue: true,
        sets: { orderBy: { order: 'asc' } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const publicProfile = await this.prisma.publicProfile.findUnique({ where: { userId } });
    if (!publicProfile)
      throw new NotFoundException('Public profile not found — complete your profile before sending emails');

    const invoiceContext = invoiceId
      ? await this.buildInvoiceContext(invoiceId, { bookingId }, userId, issueDateOverride, dueDateOverride)
      : EMPTY_INVOICE_CONTEXT;

    return {
      customerName: booking.customer.name,
      greetingName: booking.customer.greetingName ?? booking.customer.name,
      bookingDate: booking.date ? booking.date.toISOString().split('T')[0] : '',
      venueName: booking.venue?.name ?? '',
      bookingFee: booking.fee != null ? `£${Number(booking.fee).toFixed(2)}` : '',
      setsSchedule: buildSetsSchedule(booking.sets),
      musicianName: publicProfile.displayName ?? publicProfile.businessName ?? '',
      musicianEmail: publicProfile.email ?? '',
      portalLink: `${process.env.APP_BASE_URL}/booking/${booking.portalToken}`,
      ...invoiceContext,
    };
  }

  // Which dates an existing series invoice covers. Read from the invoice's *line items*, not
  // from current series membership: reconciliation only syncs a DRAFT invoice, so once one is
  // sent, membership drifts from what was actually billed — and the cover email describes the
  // attached PDF. Hand-added lines carry no sourceBookingId and are skipped (CONTEXT.md →
  // Invoice → "Series lines trace to a booking").
  private async buildSeriesDatesCovered(userId: string, invoiceId: string, seriesId: string): Promise<string> {
    const lines = await this.prisma.invoiceLineItem.findMany({
      // Scoped by the owning series as well as the tenant, matching buildInvoiceContext: a
      // mismatched (series, invoice) pair must yield nothing, not dates for someone else's
      // invoice alongside empty money fields.
      where: { userId, invoiceId, invoice: { seriesId }, sourceBookingId: { not: null } },
      select: { sourceBooking: { select: { id: true, date: true } } },
    });

    const byBooking = new Map<string, Date>();
    for (const line of lines) {
      if (line.sourceBooking) byBooking.set(line.sourceBooking.id, line.sourceBooking.date);
    }
    return buildDatesCovered([...byBooking.values()]);
  }

  // Series-shaped counterpart to buildContext (#846). The series customer is authoritative for
  // who the invoice is addressed to — it may differ from any member booking's own customer
  // (CONTEXT.md → BookingSeries → Membership), which is precisely why the booking-shaped
  // builder cannot stand in here.
  async buildSeriesContext(
    userId: string,
    seriesId: string,
    invoiceId?: string,
    issueDateOverride?: string,
    dueDateOverride?: string,
  ): Promise<SeriesEmailContext> {
    const series = await this.prisma.bookingSeries.findFirst({
      where: { id: seriesId, userId },
      include: { customer: true },
    });
    if (!series) throw new NotFoundException('Series not found');

    const publicProfile = await this.prisma.publicProfile.findUnique({ where: { userId } });
    if (!publicProfile)
      throw new NotFoundException('Public profile not found — complete your profile before sending emails');

    const invoiceContext = invoiceId
      ? await this.buildInvoiceContext(invoiceId, { seriesId }, userId, issueDateOverride, dueDateOverride)
      : EMPTY_INVOICE_CONTEXT;

    return {
      customerName: series.customer.name,
      greetingName: series.customer.greetingName ?? series.customer.name,
      seriesLabel: series.label,
      datesCovered: invoiceId ? await this.buildSeriesDatesCovered(userId, invoiceId, seriesId) : '',
      musicianName: publicProfile.displayName ?? publicProfile.businessName ?? '',
      musicianEmail: publicProfile.email ?? '',
      ...invoiceContext,
    };
  }

  // Rich-text body: substitute on the Tiptap tree once, then render. The HTML
  // renderer is a pure output adapter over the substituted tree — variable values
  // land as text nodes and pass through the renderer's text-node escaping, so a
  // customer/venue name containing markup can no longer inject into the outbound
  // body (#689, ADR-0064). The old regex-on-HTML loop that substituted unescaped
  // values is gone.
  renderTemplate(content: unknown, context: TemplateContext): RenderResult {
    const missing = new Set<string>();
    const substituted = substituteTiptapVariables(content, context, missing);
    return { html: renderTiptap(substituted), missingVariables: [...missing] };
  }

  // Subject is an email header, not a body: it stays a plain string — never
  // escaped (escaping `&`→`&amp;` in a header is a bug) and never `<br>`-broken.
  // It shares only variable *resolution* with the body path via resolveVar, so
  // the fallback catalogue and missing-variable semantics can't drift (ADR-0064).
  renderSubject(builtInType: string | null, context: TemplateContext): { subject: string; missingVariables: string[] } {
    const template = (builtInType && TEMPLATE_DEFAULT_SUBJECTS[builtInType]) ?? '';
    const missing = new Set<string>();
    const subject = template.replace(/\{\{(\w+)\}\}/g, (_, key) => resolveVar(key, context, missing));
    return { subject, missingVariables: [...missing] };
  }

  /**
   * Render a template's subject *and* body against one context, merging the two missing-variable
   * sets. Owned here rather than by each compose controller so the booking-shaped and
   * series-shaped surfaces can never diverge on what "missing" means (ADR-0064).
   */
  renderForCompose(template: RenderableTemplate, context: TemplateContext): ComposeRender {
    const { html, missingVariables: bodyMissing } = this.renderTemplate(template.content, context);
    const { subject, missingVariables: subjectMissing } = this.renderSubject(template.builtInType, context);
    return { subject, body: html, missingVariables: [...new Set([...subjectMissing, ...bodyMissing])] };
  }

  async sendBatch(emails: MailTransportOptions[]): Promise<void> {
    if (emails.length === 0) return;
    await this.resend.batch.send(
      emails.map(({ subject, body, to }) => ({
        from: process.env.RESEND_FROM ?? 'noreply@gigman.com',
        to: this.resolveRecipient(to),
        subject,
        html: body,
      })),
    );
  }

  async send(options: MailTransportOptions): Promise<void> {
    const { to, subject, body, attachments, senderIdentity } = options;
    const fromAddress = process.env.RESEND_FROM ?? 'noreply@gigman.com';

    // #932: senderIdentity is opt-in (only CommunicationsService's client-facing sends pass
    // it) — its absence must reproduce today's plain `fromAddress` exactly, so portal
    // notifications and the digest are byte-for-byte unaffected.
    const from = senderIdentity ? `${senderIdentity.name || 'GigLoop'} <${fromAddress}>` : fromAddress;

    // Resend SDK v6 never throws — it returns { data, error }. Check explicitly
    // so that rejected requests surface as errors rather than silently succeeding.
    const { error } = await this.resend.emails.send({
      from,
      to: this.resolveRecipient(to),
      subject,
      html: body,
      ...(senderIdentity?.email ? { replyTo: senderIdentity.email } : {}),
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        // Resend SDK v6 uses JSON.stringify internally; Buffer serialises as
        // {type:'Buffer',data:[...]} which the API silently drops as invalid.
        content: a.content.toString('base64'),
      })),
    });

    if (error) {
      throw new Error(`Resend rejected the email: ${error.name} — ${JSON.stringify(error)}`);
    }
  }
}
