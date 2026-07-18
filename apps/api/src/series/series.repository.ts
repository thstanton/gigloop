import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  create(userId: string, label: string, customerId: string) {
    return this.prisma.bookingSeries.create({
      data: { userId, label, customerId },
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

  // ─── Series-aggregate invoice ops (ADR-0063) ─────────────────────────────────
  // Membership logic that happens to read/write invoice *lines* — building an invoice from
  // member bookings and reconciling lines on join/leave. Distinct from Invoice lifecycle CRUD,
  // which lives in invoices.repository.

  findMemberBookingsForInvoice(userId: string, seriesId: string) {
    return this.prisma.booking.findMany({
      where: { seriesId, userId },
      include: { sets: { orderBy: { order: 'asc' } } },
      orderBy: { date: 'asc' },
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
}
