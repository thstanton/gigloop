import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';

const invoiceIncludes = {
  lineItems: { orderBy: { order: 'asc' } },
  billToContact: true,
} as const;

@Injectable()
export class InvoicesRepository {
  constructor(private prisma: PrismaService) {}

  findBookingCustomerId(
    userId: string,
    bookingId: string,
  ): Promise<string | null> {
    return this.prisma.booking
      .findFirst({ where: { id: bookingId, userId }, select: { customerId: true } })
      .then((b) => b?.customerId ?? null);
  }

  findAll(userId: string, bookingId: string) {
    return this.prisma.invoice.findMany({
      where: { userId, bookingId },
      include: invoiceIncludes,
      orderBy: { issueDate: 'asc' },
    });
  }

  findOne(userId: string, bookingId: string, id: string) {
    return this.prisma.invoice.findFirst({
      where: { id, userId, bookingId },
      include: invoiceIncludes,
    });
  }

  create(
    userId: string,
    bookingId: string,
    billToContactId: string,
    dto: CreateInvoiceDto,
  ) {
    const { lineItems, billToContactId: _ignored, issueDate, dueDate, ...fields } = dto;
    return this.prisma.invoice.create({
      data: {
        userId,
        bookingId,
        billToContactId,
        ...fields,
        ...(issueDate ? { issueDate: new Date(issueDate) } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        lineItems: lineItems?.length
          ? {
              create: lineItems.map((item, i) => ({
                userId,
                ...item,
                order: item.order ?? i,
              })),
            }
          : undefined,
      },
      include: invoiceIncludes,
    });
  }

  update(id: string, dto: UpdateInvoiceDto) {
    const { issueDate, dueDate, ...fields } = dto;
    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...fields,
        ...(issueDate ? { issueDate: new Date(issueDate) } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
      include: invoiceIncludes,
    });
  }

  delete(id: string) {
    return this.prisma.invoice.delete({ where: { id } });
  }

  findLineItem(userId: string, invoiceId: string, itemId: string) {
    return this.prisma.invoiceLineItem.findFirst({
      where: { id: itemId, invoiceId, userId },
    });
  }

  addLineItem(userId: string, invoiceId: string, dto: CreateLineItemDto) {
    return this.prisma.invoiceLineItem.create({
      data: { userId, invoiceId, ...dto },
    });
  }

  updateLineItem(itemId: string, dto: UpdateLineItemDto) {
    return this.prisma.invoiceLineItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  deleteLineItem(itemId: string) {
    return this.prisma.invoiceLineItem.delete({ where: { id: itemId } });
  }
}
