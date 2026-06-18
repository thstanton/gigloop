import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  findOne(userId: string, id: string) {
    return this.prisma.bookingSeries.findFirst({
      where: { id, userId },
      include: {
        ...seriesIncludes,
        bookings: { select: { id: true }, where: { userId } },
        invoices: { select: { id: true, status: true }, where: { userId } },
      },
    });
  }

  findExists(userId: string, id: string) {
    return this.prisma.bookingSeries.findFirst({
      where: { id, userId },
      select: { id: true },
    });
  }

  findOneLight(userId: string, id: string) {
    return this.prisma.bookingSeries.findFirst({
      where: { id, userId },
      include: seriesIncludes,
    });
  }

  findSeriesCustomerId(userId: string, id: string) {
    return this.prisma.bookingSeries.findFirst({
      where: { id, userId },
      select: { customerId: true },
    });
  }

  findEarliestMemberBooking(userId: string, seriesId: string) {
    return this.prisma.booking.findFirst({
      where: { seriesId, userId },
      orderBy: { createdAt: 'asc' },
      include: {
        packages: { select: { packageId: true }, orderBy: { order: 'asc' } },
        checklistItems: { orderBy: { order: 'asc' } },
        musicFormConfig: true,
      },
    });
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

  findSeriesBookings(userId: string, seriesId: string) {
    return this.prisma.booking.findMany({
      where: { seriesId, userId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        venue: { select: { id: true, name: true } },
        bookingAgent: { select: { id: true, name: true } },
        sets: { select: { startTime: true }, orderBy: { order: 'asc' as const }, take: 1 },
        series: { select: { id: true, label: true } },
      },
      orderBy: { date: 'asc' },
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
    lineItems: Array<{ description: string; amount: number; order: number; sourceBookingId?: string }>,
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

  findNonDraftNonVoidSeriesInvoice(userId: string, seriesId: string) {
    return this.prisma.invoice.findFirst({
      where: { seriesId, userId, status: { notIn: ['DRAFT', 'VOID'] } },
      select: { id: true, status: true },
    });
  }

  findDraftSeriesInvoiceWithLines(userId: string, seriesId: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.prisma).invoice.findFirst({
      where: { seriesId, userId, status: 'DRAFT' },
      include: { lineItems: { orderBy: { order: 'asc' } } },
    });
  }

  appendSeriesInvoiceLine(
    userId: string,
    invoiceId: string,
    line: { description: string; amount: number; order: number; sourceBookingId: string },
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.prisma).invoiceLineItem.create({
      data: { userId, invoiceId, ...line },
    });
  }

  removeSeriesInvoiceLine(lineId: string) {
    return this.prisma.invoiceLineItem.delete({ where: { id: lineId } });
  }

  markSeriesInvoicePaid(invoiceId: string) {
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
      include: invoiceIncludes,
    });
  }
}
