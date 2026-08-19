import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoicesRepository } from './invoices.repository';
import { DocumentsService } from '../documents/documents.service';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';
import { ContactsService } from '../contacts/contacts.service';
import { InvoiceTransitionService } from './invoice-transition.service';
import { isEditable, isDeletable, type InvoiceForRules } from './invoice-transition-rules';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MarkSentDto } from './dto/mark-sent.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';

// What the shared write helpers actually need from a resolved invoice: the fields the status
// rules read, plus its id. Deliberately narrower than the Prisma row, so the helpers work
// unchanged whichever route resolved the invoice.
type EditableInvoice = InvoiceForRules & { id: string };

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

  // Owner-agnostic read (ADR-0069). Returns the same shape as the owner-scoped `findOne`,
  // so a caller that does not know (or care) whether an invoice belongs to a booking or a
  // series can resolve it. 404 covers both "no such invoice" and "another tenant's invoice" —
  // the caller cannot tell them apart, which is the intent.
  async findById(userId: string, id: string) {
    const invoice = await this.repo.findById(userId, id);
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
    return this.applyUpdate(userId, await this.findOne(userId, bookingId, id), dto);
  }

  // Owner-agnostic entry point (ADR-0069). Differs from `update` only in how the invoice is
  // resolved; the rules below are shared, so a series invoice cannot drift from a booking one.
  async updateById(userId: string, id: string, dto: UpdateInvoiceDto) {
    return this.applyUpdate(userId, await this.findById(userId, id), dto);
  }

  private async applyUpdate(userId: string, invoice: EditableInvoice, dto: UpdateInvoiceDto) {
    if (!isEditable(invoice)) throw new BadRequestException('Only draft invoices can be updated');
    // FK-ownership (#709): a re-pointed billTo contact must belong to the caller — invoiceIncludes
    // returns billToContact, so a foreign id would otherwise leak on the next read.
    await this.contacts.assertOwned(userId, [dto.billToContactId]);
    return this.repo.update(invoice.id, dto);
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

  async markPaid(userId: string, bookingId: string, id: string, dto: MarkPaidDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    return this.transition.markPaid(invoice, dto);
  }

  async correctPayment(userId: string, bookingId: string, id: string, dto: MarkPaidDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    return this.transition.correctPayment(invoice, dto);
  }

  async voidInvoice(userId: string, bookingId: string, id: string) {
    const invoice = await this.findOne(userId, bookingId, id);
    return this.transition.voidInvoice(invoice);
  }

  async addLineItem(userId: string, bookingId: string, id: string, dto: CreateLineItemDto) {
    return this.applyAddLineItem(userId, await this.findOne(userId, bookingId, id), dto);
  }

  async updateLineItem(userId: string, bookingId: string, id: string, itemId: string, dto: UpdateLineItemDto) {
    return this.applyUpdateLineItem(userId, await this.findOne(userId, bookingId, id), itemId, dto);
  }

  async deleteLineItem(userId: string, bookingId: string, id: string, itemId: string) {
    return this.applyDeleteLineItem(userId, await this.findOne(userId, bookingId, id), itemId);
  }

  // Owner-agnostic line-item operations (ADR-0069). Until #845 these existed only under
  // /bookings/:bookingId/invoices, which is why a series invoice's lines had never been
  // editable — and why ADR-0043's reconciler guard had been protecting an empty set.
  async addLineItemById(userId: string, id: string, dto: CreateLineItemDto) {
    return this.applyAddLineItem(userId, await this.findById(userId, id), dto);
  }

  async updateLineItemById(userId: string, id: string, itemId: string, dto: UpdateLineItemDto) {
    return this.applyUpdateLineItem(userId, await this.findById(userId, id), itemId, dto);
  }

  async deleteLineItemById(userId: string, id: string, itemId: string) {
    return this.applyDeleteLineItem(userId, await this.findById(userId, id), itemId);
  }

  private applyAddLineItem(userId: string, invoice: EditableInvoice, dto: CreateLineItemDto) {
    this.assertLineItemsEditable(invoice);
    return this.repo.addLineItem(userId, invoice.id, dto);
  }

  private async applyUpdateLineItem(
    userId: string,
    invoice: EditableInvoice,
    itemId: string,
    dto: UpdateLineItemDto,
  ) {
    const item = await this.loadLineItem(userId, invoice, itemId);
    return this.repo.updateLineItem(item.id, dto);
  }

  private async applyDeleteLineItem(userId: string, invoice: EditableInvoice, itemId: string) {
    const item = await this.loadLineItem(userId, invoice, itemId);
    return this.repo.deleteLineItem(item.id);
  }

  private assertLineItemsEditable(invoice: EditableInvoice) {
    if (!isEditable(invoice)) {
      throw new BadRequestException('Line items can only be modified on DRAFT invoices');
    }
  }

  private async loadLineItem(userId: string, invoice: EditableInvoice, itemId: string) {
    this.assertLineItemsEditable(invoice);
    const item = await this.repo.findLineItem(userId, invoice.id, itemId);
    if (!item) throw new NotFoundException('Line item not found');
    return item;
  }
}
