import { Injectable, NotFoundException } from '@nestjs/common';
import { Resend } from 'resend';
import { CommunicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { renderTiptap } from './tiptap.renderer';
import { TEMPLATE_DEFAULT_SUBJECTS, VARIABLE_FALLBACKS } from '../templates/default-templates';

export interface EmailContext {
  customerName: string;
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

export interface SendEmailOptions {
  userId: string;
  bookingId: string;
  contactId: string;
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

@Injectable()
export class MailService {
  private resend: Resend;

  constructor(private prisma: PrismaService) {
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
    if (!publicProfile)
      throw new NotFoundException(
        'Public profile not found — complete your profile before sending emails',
      );

    let issueDate = '';
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
        issueDate = invoice.issueDate.toISOString().split('T')[0];
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
      bookingDate: booking.date ? booking.date.toISOString().split('T')[0] : '',
      venueName: booking.venue?.name ?? '',
      bookingFee: booking.fee != null ? Number(booking.fee).toFixed(2) : '',
      setsSchedule,
      musicianName: publicProfile.displayName ?? publicProfile.businessName ?? '',
      musicianEmail: publicProfile.email ?? '',
      portalLink: `${process.env.APP_BASE_URL}/booking/${booking.portalToken}`,
      issueDate,
      invoiceTotal,
      invoiceDueDate,
    };
  }

  renderTemplate(content: unknown, context: EmailContext): RenderResult {
    const html = renderTiptap(content);
    const missingVariables: string[] = [];

    const rendered = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = context[key as keyof EmailContext];
      if (value) return value;
      if (key in VARIABLE_FALLBACKS) {
        missingVariables.push(key);
        return VARIABLE_FALLBACKS[key]!;
      }
      return '';
    });

    return { html: rendered, missingVariables };
  }

  renderSubject(builtInType: string | null, context: EmailContext): { subject: string; missingVariables: string[] } {
    const template = (builtInType && TEMPLATE_DEFAULT_SUBJECTS[builtInType]) ?? '';
    const missingVariables: string[] = [];

    const subject = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = context[key as keyof EmailContext];
      if (value) return value;
      if (key in VARIABLE_FALLBACKS) {
        missingVariables.push(key);
        return VARIABLE_FALLBACKS[key]!;
      }
      return '';
    });

    return { subject, missingVariables };
  }

  async send(options: SendEmailOptions): Promise<void> {
    const { userId, bookingId, contactId, to, subject, body, templateId, attachments } = options;

    // Create the communication record as PENDING before attempting to send
    const communication = await this.prisma.communication.create({
      data: {
        userId,
        bookingId,
        contactId,
        subject,
        body,
        status: CommunicationStatus.PENDING,
        ...(templateId ? { templateId } : {}),
      },
    });

    try {
      await this.resend.emails.send({
        from: process.env.RESEND_FROM ?? 'noreply@gigman.com',
        to,
        subject,
        html: body,
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });

      await this.prisma.communication.update({
        where: { id: communication.id },
        data: { status: CommunicationStatus.SENT, sentAt: new Date() },
      });
    } catch (err) {
      await this.prisma.communication.update({
        where: { id: communication.id },
        data: { status: CommunicationStatus.FAILED },
      });
      throw err;
    }
  }
}
