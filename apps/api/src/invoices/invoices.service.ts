import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoicesRepository } from './invoices.repository';
import { DocumentsService } from '../documents/documents.service';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { ChecklistRepository } from '../checklist/checklist.repository';
import { InvoiceLifecycleService } from './invoice-lifecycle.service';
import { isEditable } from './invoice-transition-rules';
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
    private lifecycle: InvoiceLifecycleService,
    private documents: DocumentsService,
    private evaluator: ChecklistEvaluatorService,
    private checklistRepo: ChecklistRepository,
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

    const billToContactId = dto.billToContactId ?? booking.customerId;
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
    await this.lifecycle.send(
      userId,
      invoice,
      dto,
      (invId, issueDate, dueDate) =>
        this.repo.assignInvoiceNumberOnly(userId, { id: invId, bookingId, isDeposit: invoice.isDeposit, issueDate, dueDate }),
    );
  }

  async generatePreviewPdf(userId: string, bookingId: string, id: string): Promise<Buffer> {
    await this.findOne(userId, bookingId, id);
    return this.documents.generatePreviewPdf(userId, id);
  }

  async markSent(userId: string, bookingId: string, id: string, dto: MarkSentDto) {
    const invoice = await this.findOne(userId, bookingId, id);
    return this.lifecycle.markSent(
      invoice,
      dto,
      (invId, issueDate, dueDate) =>
        this.repo.assignAndMarkSent(userId, { id: invId, bookingId, isDeposit: invoice.isDeposit, issueDate, dueDate }),
    );
  }

  async markPaid(userId: string, bookingId: string, id: string) {
    const invoice = await this.findOne(userId, bookingId, id);
    return this.lifecycle.markPaid(invoice, async () => {
      if (invoice.isDeposit) {
        await this.repo.setBookingDepositReceivedAt(bookingId);
      }
      await this.evaluator.evaluate(bookingId).catch(() => {});
    });
  }

  async voidInvoice(userId: string, bookingId: string, id: string) {
    const invoice = await this.findOne(userId, bookingId, id);
    const result = await this.lifecycle.voidInvoice(invoice);
    const remaining = await this.repo.countActiveByType(bookingId, invoice.isDeposit);
    if (remaining === 0) {
      const checklistKey = invoice.isDeposit ? 'create_deposit_invoice' : 'create_balance_invoice';
      await this.checklistRepo.resetItemByKey(bookingId, checklistKey);
    }
    await this.evaluator.evaluate(bookingId).catch(() => {});
    return result;
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
