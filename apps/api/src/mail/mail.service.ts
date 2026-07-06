import { Injectable, NotFoundException } from '@nestjs/common';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { renderTiptap } from './tiptap.renderer';
import { TEMPLATE_DEFAULT_SUBJECTS, VARIABLE_FALLBACKS } from '../templates/default-templates';

export interface EmailContext {
  customerName: string;
  greetingName: string;
  bookingDate: string;
  venueName: string;
  bookingFee: string;
  setsSchedule: string;
  musicianName: string;
  musicianEmail: string;
  portalLink: string;
  issueDate: string;
  invoiceTotal: string;
  invoiceDueDate: string;
}

export interface RenderResult {
  html: string;
  missingVariables: string[];
}

export interface MailTransportOptions {
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
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

  private async buildInvoiceContext(
    invoiceId: string,
    bookingId: string,
    userId: string,
    issueDateOverride?: string,
    dueDateOverride?: string,
  ): Promise<{ issueDate: string; invoiceTotal: string; invoiceDueDate: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, bookingId, userId },
      include: { lineItems: true },
    });
    if (!invoice) return { issueDate: '', invoiceTotal: '', invoiceDueDate: '' };

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
      ? await this.buildInvoiceContext(invoiceId, bookingId, userId, issueDateOverride, dueDateOverride)
      : { issueDate: '', invoiceTotal: '', invoiceDueDate: '' };

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

  renderTemplate(content: unknown, context: EmailContext): RenderResult {
    const html = renderTiptap(content);
    const missingVariables: string[] = [];

    const rendered = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = context[key as keyof EmailContext];
      if (value) return value.replace(/\n/g, '<br>');
      missingVariables.push(key);
      return VARIABLE_FALLBACKS[key] ?? '';
    });

    return { html: rendered, missingVariables: [...new Set(missingVariables)] };
  }

  renderSubject(builtInType: string | null, context: EmailContext): { subject: string; missingVariables: string[] } {
    const template = (builtInType && TEMPLATE_DEFAULT_SUBJECTS[builtInType]) ?? '';
    const missingVariables: string[] = [];

    const subject = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = context[key as keyof EmailContext];
      if (value) return value;
      missingVariables.push(key);
      return VARIABLE_FALLBACKS[key] ?? '';
    });

    return { subject, missingVariables: [...new Set(missingVariables)] };
  }

  async sendBatch(emails: MailTransportOptions[]): Promise<void> {
    if (emails.length === 0) return;
    await this.resend.batch.send(
      emails.map(({ subject, body, to }) => ({
        from: process.env.RESEND_FROM ?? 'noreply@gigman.com',
        to,
        subject,
        html: body,
      })),
    );
  }

  async send(options: MailTransportOptions): Promise<void> {
    const { subject, body, attachments } = options;

    // Resend SDK v6 never throws — it returns { data, error }. Check explicitly
    // so that rejected requests surface as errors rather than silently succeeding.
    const { error } = await this.resend.emails.send({
      from: process.env.RESEND_FROM ?? 'noreply@gigman.com',
      // TODO: For testing purposes only send emails to my address. When domain is set up this can be changed.
      // to,
      to: 'thstanton@proton.me',
      subject,
      html: body,
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
