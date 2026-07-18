import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SeriesRepository } from './series.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { InvoiceTransitionService } from '../invoices/invoice-transition.service';
import { reconcile } from '../invoices/series-line-reconciler';
import { isDeletable } from '../invoices/invoice-transition-rules';
import { SendInvoiceDto } from '../invoices/dto/send-invoice.dto';
import { MarkSentDto } from '../invoices/dto/mark-sent.dto';
import { IssueInvoiceDto } from '../invoices/dto/issue-invoice.dto';

function buildLineItemDescription(date: Date, sets: Array<{ label: string | null; duration: number }>): string {
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const setsStr = sets.map((s) => `${s.label ?? 'Set'} (${s.duration} min)`).join(', ');
  return setsStr ? `${dateStr} — ${setsStr}` : dateStr;
}

export interface MemberBookingForSync {
  id: string;
  date: Date;
  fee: { toNumber(): number } | number | string | null;
  sets: Array<{ label: string | null; duration: number }>;
}

function memberFeeAmount(fee: MemberBookingForSync['fee']): number {
  if (fee === null) return 0;
  if (typeof fee === 'number') return fee;
  if (typeof fee === 'string') return Number(fee);
  return fee.toNumber();
}

@Injectable()
export class SeriesService {
  constructor(
    private repo: SeriesRepository,
    private invoicesRepo: InvoicesRepository,
    private transition: InvoiceTransitionService,
  ) {}

  findAll(userId: string) {
    return this.repo.findAll(userId);
  }

  async findOne(userId: string, id: string) {
    const series = await this.repo.findOne(userId, id);
    if (!series) throw new NotFoundException('Series not found');
    const { bookings, invoices, ...baseFields } = series;
    const activeInvoice = invoices.find((i) => i.status !== 'VOID') ?? null;
    return {
      ...baseFields,
      memberBookingCount: bookings.length,
      invoiceStatus: activeInvoice?.status ?? null,
    };
  }

  async getBookings(userId: string, id: string) {
    const series = await this.repo.findExists(userId, id);
    if (!series) throw new NotFoundException('Series not found');
    return this.repo.findSeriesBookings(userId, id);
  }

  // ─── Invoice operations ────────────────────────────────────────────────────

  private async requireSeries(userId: string, seriesId: string) {
    const series = await this.repo.findOneMinimal(userId, seriesId);
    if (!series) throw new NotFoundException('Series not found');
    return series;
  }

  async createInvoice(userId: string, seriesId: string) {
    const series = await this.requireSeries(userId, seriesId);

    const existing = await this.invoicesRepo.countNonVoidSeriesInvoices(userId, seriesId);
    if (existing > 0) throw new ConflictException('A non-VOID invoice already exists for this series');

    const bookings = await this.repo.findMemberBookingsForInvoice(userId, seriesId);
    if (bookings.length === 0) throw new BadRequestException('Series has no member bookings');

    const lineItems = bookings.map((b, i) => ({
      description: buildLineItemDescription(b.date, b.sets),
      amount: b.fee ? Number(b.fee) : 0,
      order: i,
      sourceBookingId: b.id,
    }));

    return this.invoicesRepo.createSeriesInvoice(userId, seriesId, series.customerId, lineItems);
  }

  async getActiveInvoice(userId: string, seriesId: string) {
    await this.requireSeries(userId, seriesId);
    return this.invoicesRepo.findActiveSeriesInvoice(userId, seriesId);
  }

  async previewInvoiceNumber(userId: string, seriesId: string) {
    await this.requireSeries(userId, seriesId);
    return this.invoicesRepo.previewSeriesInvoiceNumber(userId, seriesId);
  }

  async issueInvoice(userId: string, seriesId: string, invoiceId: string, dto: IssueInvoiceDto) {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.transition.issueInvoice(userId, invoice, dto);
  }

  async voidInvoice(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.transition.voidInvoice(invoice);
  }

  async deleteInvoice(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!isDeletable(invoice)) throw new BadRequestException('Only DRAFT invoices can be deleted');
    return this.invoicesRepo.delete(invoiceId);
  }

  async sendInvoice(userId: string, seriesId: string, invoiceId: string, dto: SendInvoiceDto) {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.transition.send(userId, invoice, dto);
  }

  async markSentInvoice(userId: string, seriesId: string, invoiceId: string, dto: MarkSentDto) {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.transition.markSent(invoice, dto);
  }

  async markPaidInvoice(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.transition.markPaid(invoice);
  }

  // ─── Series membership guard + sync ───────────────────────────────────────

  /**
   * Throws 409 if the series has an active (ISSUED, SENT, or PAID) invoice.
   * Call before any membership add or remove to prevent mutating a frozen billing batch.
   */
  async assertMembershipMutable(userId: string, seriesId: string): Promise<void> {
    const locked = await this.invoicesRepo.findNonDraftNonVoidSeriesInvoice(userId, seriesId);
    if (locked) {
      throw new ConflictException(
        'This series has an issued invoice — void the invoice before changing the lineup.',
      );
    }
  }

  /**
   * After a booking joins a series, append a traced line to the series DRAFT invoice (if any).
   * No-op when no DRAFT invoice exists.
   */
  async syncMemberJoin(
    userId: string,
    seriesId: string,
    booking: MemberBookingForSync,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const draftInvoice = await this.repo.findDraftSeriesInvoiceWithLines(userId, seriesId, tx);
    if (!draftInvoice) return;

    const { add } = reconcile(draftInvoice.lineItems, [
      {
        id: booking.id,
        description: buildLineItemDescription(booking.date, booking.sets),
        amount: memberFeeAmount(booking.fee),
      },
    ]);
    if (add.length === 0) return;

    const maxOrder = draftInvoice.lineItems.reduce((m, l) => Math.max(m, l.order), -1);
    await this.repo.appendSeriesInvoiceLine(
      userId,
      draftInvoice.id,
      {
        description: add[0].description,
        amount: add[0].amount,
        order: maxOrder + 1,
        sourceBookingId: booking.id,
      },
      tx,
    );
  }

  /**
   * After a booking leaves a series, remove its traced line from the series DRAFT invoice (if any).
   * No-op when no DRAFT invoice exists or the booking had no traced line.
   */
  async syncMemberLeave(userId: string, seriesId: string, bookingId: string): Promise<void> {
    const draftInvoice = await this.repo.findDraftSeriesInvoiceWithLines(userId, seriesId);
    if (!draftInvoice) return;

    const tracedLines = draftInvoice.lineItems.filter((l) => l.sourceBookingId === bookingId);
    for (const line of tracedLines) {
      await this.repo.removeSeriesInvoiceLine(line.id);
    }
  }
}
