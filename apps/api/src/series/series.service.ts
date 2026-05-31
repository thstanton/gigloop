import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SeriesRepository } from './series.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { DocumentsService } from '../documents/documents.service';
import { CommunicationsService } from '../communications/communications.service';
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
    private documents: DocumentsService,
    private comms: CommunicationsService,
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

  // ─── Invoice operations ────────────────────────────────────────────────────

  private async requireSeries(userId: string, seriesId: string) {
    const series = await this.repo.findOneMinimal(userId, seriesId);
    if (!series) throw new NotFoundException('Series not found');
    return series;
  }

  private async assignSeriesInvoiceNumber(
    userId: string, seriesId: string, invoiceId: string,
    dto: { issueDate: string; dueDate?: string },
  ) {
    const issueDate = new Date(dto.issueDate);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const voided = await this.repo.findVoidedSeriesInvoiceWithNumber(userId, seriesId);
    return voided?.invoiceNumber
      ? this.invoicesRepo.assignWithInheritedNumber(invoiceId, voided.invoiceNumber, issueDate, dueDate)
      : this.invoicesRepo.assignAndMarkSent(userId, invoiceId, issueDate, dueDate);
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
    const invoice = await this.repo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'DRAFT') throw new BadRequestException('Draft invoices cannot be voided — delete them instead');
    if (invoice.status === 'VOID') throw new BadRequestException('Invoice is already VOID');
    return this.invoicesRepo.voidInvoice(invoiceId);
  }

  async deleteInvoice(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.repo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'DRAFT') throw new BadRequestException('Only DRAFT invoices can be deleted');
    return this.invoicesRepo.delete(invoiceId);
  }

  async sendInvoice(userId: string, seriesId: string, invoiceId: string, dto: SendInvoiceDto) {
    const invoice = await this.repo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'DRAFT') throw new BadRequestException('Only draft invoices can be sent');

    const sentInvoice = await this.assignSeriesInvoiceNumber(userId, seriesId, invoiceId, dto);

    const pdfBuffer = await this.documents.generatePreviewPdf(userId, invoiceId);
    await this.comms.sendEmail({
      userId,
      contactId: dto.contactId,
      to: dto.to,
      subject: dto.subject,
      body: dto.body,
      templateId: dto.templateId,
      attachments: [{ filename: `${sentInvoice.invoiceNumber ?? 'invoice'}.pdf`, content: pdfBuffer }],
    });
  }

  async markSentInvoice(userId: string, seriesId: string, invoiceId: string, dto: MarkSentDto) {
    const invoice = await this.repo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'DRAFT') throw new BadRequestException('Only draft invoices can be marked as sent');

    return this.assignSeriesInvoiceNumber(userId, seriesId, invoiceId, dto);
  }

  async markPaidInvoice(userId: string, seriesId: string, invoiceId: string) {
    const invoice = await this.repo.findSeriesInvoiceById(userId, seriesId, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'SENT') throw new BadRequestException('Only sent invoices can be marked as paid');
    return this.repo.markSeriesInvoicePaid(invoiceId);
  }
}
