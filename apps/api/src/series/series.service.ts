import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SeriesRepository } from './series.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { InvoiceLifecycleService } from '../invoices/invoice-lifecycle.service';
import { isDeletable } from '../invoices/invoice-transition-rules';
import { SendInvoiceDto } from '../invoices/dto/send-invoice.dto';
import { MarkSentDto } from '../invoices/dto/mark-sent.dto';

function buildLineItemDescription(date: Date, sets: Array<{ label: string | null; duration: number }>): string {
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const setsStr = sets.map((s) => `${s.label ?? 'Set'} (${s.duration} min)`).join(', ');
  return setsStr ? `${dateStr} — ${setsStr}` : dateStr;
}

@Injectable()
export class SeriesService {
  constructor(
    private repo: SeriesRepository,
    private invoicesRepo: InvoicesRepository,
    private lifecycle: InvoiceLifecycleService,
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

  async findDefaults(userId: string, id: string) {
    const series = await this.repo.findSeriesCustomerId(userId, id);
    if (!series) throw new NotFoundException('Series not found');

    const earliest = await this.repo.findEarliestMemberBooking(userId, id);
    if (!earliest) return {};

    return {
      customerId: series.customerId,
      venueId: earliest.venueId,
      bookingAgentId: earliest.bookingAgentId,
      packageIds: earliest.packages.map((bp) => bp.packageId),
      checklistItems: earliest.checklistItems.map((item) => ({
        key: item.key,
        label: item.label,
        completedBy: item.completedBy as 'USER' | 'CUSTOMER' | 'BAND_MEMBER',
        dependsOn: item.dependsOn,
        autoCompleteRule: item.autoCompleteRule as Record<string, unknown> | null,
        requiredForStatus: item.requiredForStatus as 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null,
        dueDateRule: item.dueDateRule as Record<string, unknown> | null,
        enabled: true,
      })),
      musicFormConfig: earliest.musicFormConfig
        ? {
            enabledGenres: earliest.musicFormConfig.enabledGenres,
            keyMoments: earliest.musicFormConfig.keyMoments,
          }
        : null,
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

  private async requireSeriesInvoice(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.repo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async createInvoice(userId: string, seriesId: string) {
    const series = await this.requireSeries(userId, seriesId);

    const existing = await this.repo.countNonVoidSeriesInvoices(userId, seriesId);
    if (existing > 0) throw new ConflictException('A non-VOID invoice already exists for this series');

    const bookings = await this.repo.findMemberBookingsForInvoice(userId, seriesId);
    if (bookings.length === 0) throw new BadRequestException('Series has no member bookings');

    const lineItems = bookings.map((b, i) => ({
      description: buildLineItemDescription(b.date, b.sets),
      amount: b.fee ? Number(b.fee) : 0,
      order: i,
    }));

    return this.repo.createSeriesInvoice(userId, seriesId, series.customerId, lineItems);
  }

  async getActiveInvoice(userId: string, seriesId: string) {
    await this.requireSeries(userId, seriesId);
    return this.repo.findActiveSeriesInvoice(userId, seriesId);
  }

  async voidInvoice(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.requireSeriesInvoice(userId, seriesId, invoiceId);
    return this.lifecycle.voidInvoice(invoice);
  }

  async deleteInvoice(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.requireSeriesInvoice(userId, seriesId, invoiceId);
    if (!isDeletable(invoice)) throw new BadRequestException('Only DRAFT invoices can be deleted');
    return this.invoicesRepo.delete(invoiceId);
  }

  async sendInvoice(userId: string, seriesId: string, invoiceId: string, dto: SendInvoiceDto) {
    const invoice = await this.requireSeriesInvoice(userId, seriesId, invoiceId);
    await this.lifecycle.send(
      userId,
      invoice,
      dto,
      (id, issueDate, dueDate) =>
        this.invoicesRepo.assignSeriesInvoiceNumberOnly(userId, { id, seriesId, issueDate, dueDate }),
    );
  }

  async markSentInvoice(userId: string, seriesId: string, invoiceId: string, dto: MarkSentDto) {
    const invoice = await this.requireSeriesInvoice(userId, seriesId, invoiceId);
    return this.lifecycle.markSent(
      invoice,
      dto,
      async (id, issueDate, dueDate) => {
        const voided = await this.repo.findVoidedSeriesInvoiceWithNumber(userId, seriesId);
        return voided?.invoiceNumber
          ? this.invoicesRepo.assignWithInheritedNumber(id, voided.invoiceNumber, issueDate, dueDate)
          : this.invoicesRepo.assignNewSequenceNumber(userId, id, issueDate, dueDate);
      },
    );
  }

  async markPaidInvoice(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.requireSeriesInvoice(userId, seriesId, invoiceId);
    return this.lifecycle.markPaid(invoice);
  }
}
