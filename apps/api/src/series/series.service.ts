import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SeriesRepository } from './series.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { InvoiceTransitionService } from '../invoices/invoice-transition.service';
import { DocumentsService } from '../documents/documents.service';
import { computeJoinInsertion, reconcile } from '../invoices/series-line-reconciler';
import { isDeletable } from '../invoices/invoice-transition-rules';
import { SendInvoiceDto } from '../invoices/dto/send-invoice.dto';
import { MarkSentDto } from '../invoices/dto/mark-sent.dto';
import { MarkPaidDto } from '../invoices/dto/mark-paid.dto';
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

const NO_ACTIVE_SERIES_INVOICE_MESSAGE = 'A non-VOID invoice already exists for this series';

// True for a P2002 raised by `Invoice_seriesId_active_key` (#852) — the partial unique index
// backing this same message's TOCTOU-racy count-then-create guard above.
function isActiveSeriesInvoiceViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as unknown[]).includes('seriesId')
  );
}

@Injectable()
export class SeriesService {
  constructor(
    private repo: SeriesRepository,
    private invoicesRepo: InvoicesRepository,
    private transition: InvoiceTransitionService,
    private documents: DocumentsService,
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
    if (existing > 0) throw new ConflictException(NO_ACTIVE_SERIES_INVOICE_MESSAGE);

    const bookings = await this.repo.findMemberBookingsForInvoice(userId, seriesId);
    if (bookings.length === 0) throw new BadRequestException('Series has no member bookings');

    // A fee-less member still gets a £0.00 line (the date must appear on the invoice) — the count
    // is surfaced to the musician so it never reaches a client unnoticed (#850).
    const feelessMemberCount = bookings.filter((b) => b.fee === null).length;

    const lineItems = bookings.map((b, i) => ({
      description: buildLineItemDescription(b.date, b.sets),
      amount: b.fee ? Number(b.fee) : 0,
      order: i,
      sourceBookingId: b.id,
    }));

    // The count check above is a TOCTOU-racy guard, not a guarantee — a concurrent request can
    // pass it too. `Invoice_seriesId_active_key` (#852) is the real backstop; only creation can
    // ever violate it (no code path updates an existing invoice's seriesId or un-voids a row), so
    // a violation here is always this series' active-invoice conflict, mapped to the same 409.
    let invoice: Awaited<ReturnType<InvoicesRepository['createSeriesInvoice']>>;
    try {
      invoice = await this.invoicesRepo.createSeriesInvoice(userId, seriesId, series.customerId, lineItems);
    } catch (err) {
      if (isActiveSeriesInvoiceViolation(err)) throw new ConflictException(NO_ACTIVE_SERIES_INVOICE_MESSAGE);
      throw err;
    }
    return { invoice, feelessMemberCount };
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

  async markPaidInvoice(userId: string, seriesId: string, invoiceId: string, dto: MarkPaidDto) {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.transition.markPaid(invoice, dto);
  }

  async correctInvoicePayment(userId: string, seriesId: string, invoiceId: string, dto: MarkPaidDto) {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.transition.correctPayment(invoice, dto);
  }

  // ─── Invoice PDF access (#830) ─────────────────────────────────────────────
  //
  // A series invoice's PDF is generated and stored at issue time exactly like a booking
  // invoice's, but its Document carries `bookingId: null` (it belongs to no single booking), so
  // it appears in no booking's document list. Without these two reads the artifact exists and is
  // emailed to the client, yet the musician has no route to it at all.

  /**
   * The PDF a musician can look at *before* issuing. Regenerated from live data, so it is
   * DRAFT-only by contract: once issued, the *stored* artifact is the authority — what was
   * previewed = what is in Documents = what the client received (InvoiceTransitionService.send).
   * Issued invoices go through {@link getInvoiceDocument} instead.
   */
  async generateInvoicePreviewPdf(userId: string, seriesId: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    // A draft has no number yet — render the provisional number it would receive on issue, so the
    // preview doesn't show a placeholder for its only use case (mirrors the booking preview).
    let previewNumber: string | undefined;
    if (!invoice.invoiceNumber) {
      const { invoiceNumber } = await this.invoicesRepo.previewSeriesInvoiceNumber(userId, seriesId);
      previewNumber = invoiceNumber;
    }
    return this.documents.generatePreviewPdf(userId, invoiceId, previewNumber);
  }

  /**
   * The stored PDF backing an issued series invoice — how the client discovers the document id,
   * and from there the shared access-controlled `/documents/:id/download` route (ADR-0059).
   * Null while the invoice is a DRAFT: no PDF exists until issue.
   */
  async getInvoiceDocument(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.invoicesRepo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.documents.findByInvoice(userId, invoiceId);
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
   * After a booking joins a series, insert a traced line into the series DRAFT invoice (if any)
   * at its date position among the other auto-generated lines — a back-dated booking joining
   * mid-way lands next to its date, not at the bottom (#851). Custom lines always stay after
   * every auto-generated line. No-op when no DRAFT invoice exists.
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

    const { newOrder, reorder } = computeJoinInsertion(
      draftInvoice.lineItems.map((l) => ({
        id: l.id,
        order: l.order,
        sourceBookingId: l.sourceBookingId,
        sourceBookingDate: l.sourceBooking?.date ?? null,
      })),
      booking.date,
    );
    if (reorder.length > 0) {
      await this.repo.reorderSeriesInvoiceLines(reorder, tx);
    }

    await this.repo.appendSeriesInvoiceLine(
      userId,
      draftInvoice.id,
      {
        description: add[0].description,
        amount: add[0].amount,
        order: newOrder,
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
