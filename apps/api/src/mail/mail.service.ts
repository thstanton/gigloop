import { Injectable, NotFoundException } from '@nestjs/common';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsService } from '../communications/communications.service';
import { renderTiptap } from './tiptap.renderer';

export interface EmailContext {
  customerName: string;
  bookingDate: string;
  venueName: string;
  bookingFee: string;
  setsSchedule: string;
  musicianName: string;
  musicianEmail: string;
  portalLink: string;
  invoiceTotal: string;
  invoiceDueDate: string;
}

export interface SendEmailOptions {
  userId: string;
  bookingId: string;
  contactId: string;
  to: string;
  subject: string;
  templateId: string;
  context: EmailContext;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

@Injectable()
export class MailService {
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private communications: CommunicationsService,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async buildContext(
    userId: string,
    bookingId: string,
    invoiceId?: string,
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

    const publicProfile = await this.prisma.publicProfile.findUnique({
      where: { userId },
    });
    if (!publicProfile) throw new NotFoundException('Public profile not found — complete your profile before sending emails');

    let invoiceTotal = '';
    let invoiceDueDate = '';

    if (invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: invoiceId, bookingId, userId },
        include: { lineItems: true },
      });
      if (invoice) {
        const total = invoice.lineItems.reduce(
          (sum, item) => sum + Number(item.amount),
          0,
        );
        invoiceTotal = total.toFixed(2);
        invoiceDueDate = invoice.dueDate
          ? invoice.dueDate.toISOString().split('T')[0]
          : '';
      }
    }

    const setsSchedule =
      booking.sets.length === 0
        ? ''
        : `<ul>${booking.sets
            .map((s) => {
              const time = s.startTime ? `${s.startTime} — ` : '';
              const label = s.label ?? 'Set';
              return `<li>${time}${label} (${s.duration} min)</li>`;
            })
            .join('')}</ul>`;

    return {
      customerName: booking.customer.name,
      bookingDate: booking.date.toISOString().split('T')[0],
      venueName: booking.venue?.name ?? '',
      bookingFee: booking.fee != null ? Number(booking.fee).toFixed(2) : '',
      setsSchedule,
      musicianName: publicProfile.displayName ?? publicProfile.businessName,
      musicianEmail: publicProfile.email ?? '',
      portalLink: `${process.env.APP_BASE_URL}/booking/${booking.portalToken}`,
      invoiceTotal,
      invoiceDueDate,
    };
  }

  renderTemplate(content: unknown, context: EmailContext): string {
    const html = renderTiptap(content);
    return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = context[key as keyof EmailContext];
      return value ?? '';
    });
  }

  async send(options: SendEmailOptions): Promise<void> {
    const { userId, bookingId, contactId, to, subject, templateId, context, attachments } = options;

    const template = await this.prisma.template.findFirst({
      where: { id: templateId, userId },
    });
    if (!template) throw new NotFoundException('Template not found');

    const html = this.renderTemplate(template.content, context);

    await this.resend.emails.send({
      from: process.env.RESEND_FROM ?? 'noreply@gigman.com',
      to,
      subject,
      html,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });

    await this.communications.create(userId, bookingId, {
      contactId,
      subject,
      body: html,
      templateId,
    });
  }
}
