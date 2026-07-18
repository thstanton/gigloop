import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoicesRepository } from './invoices.repository';
import { DocumentsService } from '../documents/documents.service';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';
import { ContactsService } from '../contacts/contacts.service';
import { InvoiceTransitionService } from './invoice-transition.service';
import { isEditable, isDeletable } from './invoice-transition-rules';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MarkSentDto } from './dto/mark-sent.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private repo: InvoicesRepository,
    private transition: InvoiceTransitionService,
    private documents: DocumentsService,
    private reeval: ChecklistReevaluator,
    private contacts: ContactsService,
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
    const booking = await this.repo.findBookingInfo(userId, bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.seriesId) {
      throw new ConflictException('This booking is part of a series — invoices are managed at the series level');
    }

    const isDeposit = dto.isDeposit ?? false;
    const activeCount = await this.repo.countActiveByType(bookingId, isDeposit);
    if (activeCount > 0) {
      const type = isDeposit ? 'deposit' : 'balance';
      throw new ConflictException(`A ${type} invoice already exists for this booking — void it before creating a new one`);
    }

    // FK-ownership (#709): only an explicitly-provided billTo contact is caller-supplied and
    // needs validating; the `?? booking.customerId` fallback is already owned.
    await this.contacts.assertOwned(userId, [dto.billToContactId]);
    const billToContactId = dto.billToContactId ?? booking.customerId;
    const result = await this.repo.create(userId, bookingId, billToContactId, dto);
    await this.reeval.onBookingChanged(bookingId);
    return result;
  }

  async update(userId: string, bookingId: string, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    if (!isEditable(invoice)) throw new BadRequestException('Only draft invoices can be updated');
    // FK-ownership (#709): a re-pointed billTo contact must belong to the caller — invoiceIncludes
    // returns billToContact, so a foreign id would otherwise leak on the next read.
    await this.contacts.assertOwned(userId, [dto.billToContactId]);
    return this.repo.update(id, dto);
  }

  async delete(userId: string, bookingId: string, id: string) {
    const invoice = await this.findOne(userId, bookingId, id);
    if (!isDeletable(invoice)) throw new BadRequestException('Only draft invoices can be deleted — void an issued invoice instead');
    return this.repo.delete(id);
  }

  async issue(userId: string, bookingId: string, id: string, dto: IssueInvoiceDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    return this.transition.issueInvoice(userId, invoice, dto);
  }

  async send(userId: string, bookingId: string, id: string, dto: SendInvoiceDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    await this.transition.send(userId, invoice, dto);
  }

  previewInvoiceNumber(userId: string, bookingId: string, isDeposit: boolean) {
    return this.repo.previewBookingInvoiceNumber(userId, bookingId, isDeposit);
  }

  async generatePreviewPdf(userId: string, bookingId: string, id: string): Promise<Buffer> {
    const invoice = await this.findOne(userId, bookingId, id);
    // Drafts have no assigned number yet — render the preview with the provisional number
    // the invoice would receive on issue, so the PDF doesn't fail for its only use case.
    let previewNumber: string | undefined;
    if (!invoice.invoiceNumber) {
      const { invoiceNumber } = invoice.seriesId
        ? await this.repo.previewSeriesInvoiceNumber(userId, invoice.seriesId)
        : await this.repo.previewBookingInvoiceNumber(userId, bookingId, invoice.isDeposit);
      previewNumber = invoiceNumber;
    }
    return this.documents.generatePreviewPdf(userId, id, previewNumber);
  }

  async markSent(userId: string, bookingId: string, id: string, dto: MarkSentDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    return this.transition.markSent(invoice, dto);
  }

  async markPaid(userId: string, bookingId: string, id: string) {
    const invoice = await this.findOne(userId, bookingId, id);
    return this.transition.markPaid(invoice);
  }

  async voidInvoice(userId: string, bookingId: string, id: string) {
    const invoice = await this.findOne(userId, bookingId, id);
    return this.transition.voidInvoice(invoice);
  }

  async addLineItem(userId: string, bookingId: string, id: string, dto: CreateLineItemDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    if (!isEditable(invoice)) throw new BadRequestException('Line items can only be modified on DRAFT invoices');
    return this.repo.addLineItem(userId, id, dto);
  }

  async updateLineItem(userId: string, bookingId: string, id: string, itemId: string, dto: UpdateLineItemDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    if (!isEditable(invoice)) throw new BadRequestException('Line items can only be modified on DRAFT invoices');
    const item = await this.repo.findLineItem(userId, id, itemId);
    if (!item) throw new NotFoundException('Line item not found');
    return this.repo.updateLineItem(item.id, dto);
  }

  async deleteLineItem(userId: string, bookingId: string, id: string, itemId: string) {
    const invoice = await this.findOne(userId, bookingId, id);
    if (!isEditable(invoice)) throw new BadRequestException('Line items can only be modified on DRAFT invoices');
    const item = await this.repo.findLineItem(userId, id, itemId);
    if (!item) throw new NotFoundException('Line item not found');
    return this.repo.deleteLineItem(item.id);
  }
}
