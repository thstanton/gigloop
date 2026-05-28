import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoicesRepository } from './invoices.repository';
import { CommunicationsService } from '../communications/communications.service';
import { DocumentsService } from '../documents/documents.service';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MarkSentDto } from './dto/mark-sent.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private repo: InvoicesRepository,
    private comms: CommunicationsService,
    private documents: DocumentsService,
    private evaluator: ChecklistEvaluatorService,
  ) {}

  findAll(userId: string, bookingId: string) {
    return this.repo.findAll(userId, bookingId);
  }

  async findOne(userId: string, bookingId: string, id: string) {
    const invoice = await this.repo.findOne(userId, bookingId, id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(userId: string, bookingId: string, dto: CreateInvoiceDto) {
    const customerId = await this.repo.findBookingCustomerId(userId, bookingId);
    if (customerId === null) throw new NotFoundException('Booking not found');
    const billToContactId = dto.billToContactId ?? customerId;
    const result = await this.repo.create(userId, bookingId, billToContactId, dto);
    await this.evaluator.evaluate(bookingId).catch(() => {});
    return result;
  }

  async update(userId: string, bookingId: string, id: string, dto: UpdateInvoiceDto) {
    await this.findOne(userId, bookingId, id);
    return this.repo.update(id, dto);
  }

  async delete(userId: string, bookingId: string, id: string) {
    await this.findOne(userId, bookingId, id);
    return this.repo.delete(id);
  }

  async send(userId: string, bookingId: string, id: string, dto: SendInvoiceDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be sent');
    }

    const issueDate = new Date(dto.issueDate);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    const sentInvoice = await this.repo.assignAndMarkSent(userId, id, issueDate, dueDate);

    const { buffer: pdfBuffer } = await this.documents.generateAndStoreInvoicePdf(userId, bookingId, sentInvoice.id, sentInvoice);

    const filename = `${sentInvoice.invoiceNumber ?? 'invoice'}.pdf`;

    await this.comms.sendEmail({
      userId,
      bookingId,
      contactId: dto.contactId,
      to: dto.to,
      subject: dto.subject,
      body: dto.body,
      templateId: dto.templateId,
      attachments: [{ filename, content: pdfBuffer }],
    });
  }

  async generatePreviewPdf(userId: string, bookingId: string, id: string): Promise<Buffer> {
    await this.findOne(userId, bookingId, id);
    return this.documents.generatePreviewPdf(userId, id);
  }

  async markSent(userId: string, bookingId: string, id: string, dto: MarkSentDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be marked as sent');
    }

    const issueDate = new Date(dto.issueDate);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    return this.repo.assignAndMarkSent(userId, id, issueDate, dueDate);
  }

  async markPaid(userId: string, bookingId: string, id: string) {
    const invoice = await this.findOne(userId, bookingId, id);
    if (invoice.status !== 'SENT') {
      throw new BadRequestException('Only sent invoices can be marked as paid');
    }
    const result = await this.repo.markPaid(userId, bookingId, id);
    await this.evaluator.evaluate(bookingId).catch(() => {});
    return result;
  }

  async addLineItem(
    userId: string,
    bookingId: string,
    id: string,
    dto: CreateLineItemDto,
  ) {
    await this.findOne(userId, bookingId, id);
    return this.repo.addLineItem(userId, id, dto);
  }

  async updateLineItem(
    userId: string,
    bookingId: string,
    id: string,
    itemId: string,
    dto: UpdateLineItemDto,
  ) {
    await this.findOne(userId, bookingId, id);
    const item = await this.repo.findLineItem(userId, id, itemId);
    if (!item) throw new NotFoundException('Line item not found');
    return this.repo.updateLineItem(itemId, dto);
  }

  async deleteLineItem(
    userId: string,
    bookingId: string,
    id: string,
    itemId: string,
  ) {
    await this.findOne(userId, bookingId, id);
    const item = await this.repo.findLineItem(userId, id, itemId);
    if (!item) throw new NotFoundException('Line item not found');
    return this.repo.deleteLineItem(itemId);
  }
}
