import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { invoiceIncludes } from '../invoices/invoices.repository';

const seriesIncludes = {
  customer: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class SeriesRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.bookingSeries.findMany({
      where: { userId },
      include: seriesIncludes,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const series = await this.prisma.bookingSeries.findFirst({
      where: { id, userId },
      include: {
        ...seriesIncludes,
        bookings: { select: { id: true }, where: { userId } },
        invoices: { select: { id: true, status: true }, where: { userId } },
      },
    });
    return series;
  }

  create(userId: string, label: string, customerId: string) {
    return this.prisma.bookingSeries.create({
      data: { userId, label, customerId },
    });
  }

  // ─── Invoice methods ───────────────────────────────────────────────────────

  findActiveSeriesInvoice(userId: string, seriesId: string) {
    return this.prisma.invoice.findFirst({
      where: { seriesId, userId, status: { not: 'VOID' } },
      include: invoiceIncludes,
    });
  }

  findVoidedSeriesInvoiceWithNumber(userId: string, seriesId: string) {
    return this.prisma.invoice.findFirst({
      where: { seriesId, userId, status: 'VOID', invoiceNumber: { not: null } },
      select: { invoiceNumber: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findOneMinimal(userId: string, id: string) {
    return this.prisma.bookingSeries.findFirst({
      where: { id, userId },
      select: { id: true, customerId: true },
    });
  }

  findMemberBookingsForInvoice(userId: string, seriesId: string) {
    return this.prisma.booking.findMany({
      where: { seriesId, userId },
      include: { sets: { orderBy: { order: 'asc' } } },
      orderBy: { date: 'asc' },
    });
  }

  findSeriesInvoiceById(userId: string, seriesId: string, invoiceId: string) {
    return this.prisma.invoice.findFirst({
      where: { id: invoiceId, seriesId, userId },
      include: invoiceIncludes,
    });
  }

  createSeriesInvoice(
    userId: string,
    seriesId: string,
    billToContactId: string,
    lineItems: Array<{ description: string; amount: number; order: number }>,
  ) {
    return this.prisma.invoice.create({
      data: {
        userId,
        seriesId,
        billToContactId,
        isDeposit: false,
        lineItems: { create: lineItems.map((item) => ({ userId, ...item })) },
      },
      include: invoiceIncludes,
    });
  }

  countNonVoidSeriesInvoices(userId: string, seriesId: string) {
    return this.prisma.invoice.count({
      where: { seriesId, userId, status: { not: 'VOID' } },
    });
  }

  markSeriesInvoicePaid(invoiceId: string) {
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
      include: invoiceIncludes,
    });
  }
}
