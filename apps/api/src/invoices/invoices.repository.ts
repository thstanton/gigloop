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
      orderBy: { issueDate: { sort: 'asc', nulls: 'last' } },
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
    const { lineItems, billToContactId: _ignored, ...fields } = dto;
    return this.prisma.invoice.create({
      data: {
        userId,
        bookingId,
        billToContactId,
        ...fields,
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
    return this.prisma.invoice.update({
      where: { id },
      data: dto,
      include: invoiceIncludes,
    });
  }

  delete(id: string) {
    return this.prisma.invoice.delete({ where: { id } });
  }

  async assignAndMarkSent(
    userId: string,
    id: string,
    issueDate: Date,
    dueDate: Date | null,
  ) {
    const currentYear = new Date().getFullYear();

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.userProfile.findUnique({ where: { userId } });
      if (!profile) throw new Error('User profile not found');

      const isNewYear = profile.invoiceSequenceYear !== currentYear;
      const nextSeq = isNewYear ? 1 : profile.invoiceNumberSequence + 1;

      await tx.userProfile.update({
        where: { userId },
        data: { invoiceNumberSequence: nextSeq, invoiceSequenceYear: currentYear },
      });

      const invoiceNumber = `INV-${currentYear}-${String(nextSeq).padStart(3, '0')}`;

      return tx.invoice.update({
        where: { id },
        data: { invoiceNumber, issueDate, dueDate, status: 'SENT' },
        include: invoiceIncludes,
      });
    });
  }

  async markPaid(userId: string, bookingId: string, invoiceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const [invoice, booking, profile] = await Promise.all([
        tx.invoice.findFirst({ where: { id: invoiceId, userId, bookingId }, select: { isDeposit: true } }),
        tx.booking.findFirst({ where: { id: bookingId, userId }, select: { depositTrackingMode: true } }),
        tx.userProfile.findUnique({ where: { userId }, select: { depositTrackingMode: true } }),
      ]);

      if (!invoice) return null;

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID' },
        include: invoiceIncludes,
      });

      if (invoice.isDeposit) {
        const trackingMode = booking?.depositTrackingMode ?? profile?.depositTrackingMode ?? 'INVOICE';
        if (trackingMode === 'INVOICE') {
          await tx.booking.update({ where: { id: bookingId }, data: { depositReceivedAt: new Date() } });
        }
      }

      return updated;
    });
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
