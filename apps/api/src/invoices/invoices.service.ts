import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoicesRepository } from './invoices.repository';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';

@Injectable()
export class InvoicesService {
  constructor(private repo: InvoicesRepository) {}

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
    return this.repo.create(userId, bookingId, billToContactId, dto);
  }

  async update(userId: string, bookingId: string, id: string, dto: UpdateInvoiceDto) {
    await this.findOne(userId, bookingId, id);
    return this.repo.update(id, dto);
  }

  async delete(userId: string, bookingId: string, id: string) {
    await this.findOne(userId, bookingId, id);
    return this.repo.delete(id);
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
