import { Injectable } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsRepository {
  constructor(private prisma: PrismaService) {}

  create(userId: string, bookingId: string | undefined, type: DocumentType, storageKey: string, invoiceId?: string, contractId?: string, name?: string) {
    return this.prisma.document.create({
      data: { userId, bookingId: bookingId ?? null, type, storageKey, invoiceId, contractId, name },
    });
  }

  findById(id: string, userId: string) {
    return this.prisma.document.findFirst({ where: { id, userId } });
  }

  findByBooking(userId: string, bookingId: string) {
    return this.prisma.document.findMany({
      where: { userId, bookingId },
      include: {
        contract: { select: { status: true } },
        invoice: { select: { status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // The context the per-document portal-visibility authority needs beyond the document itself
  // (ADR-0054 / #580): the booking's active contract (most-recent, matching CONTRACT_INCLUDE) to
  // spot superseded signed-contract PDFs, its status to apply the cancelled gate, and its seriesId
  // to look up a discoverable-but-not-owned series invoice document (#848).
  findBookingVisibilityContext(userId: string, bookingId: string) {
    return this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: {
        status: true,
        seriesId: true,
        contracts: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } },
      },
    });
  }

  // The active (non-VOID) series invoice's stored PDF, if any — discoverable from every member
  // booking's Documents card even though it belongs to no single booking (#848, CONTEXT.md → "The
  // one Document with no Booking"). `bookingId: null` on the returned row is what
  // `resolveDocumentVisibility`'s ownership gate keys off downstream.
  findActiveSeriesInvoiceDocument(userId: string, seriesId: string) {
    return this.prisma.document.findFirst({
      where: { userId, type: 'INVOICE', invoice: { seriesId, status: { not: 'VOID' } } },
      include: {
        invoice: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findContractForBooking(userId: string, bookingId: string) {
    return this.prisma.document.findFirst({
      where: { userId, bookingId, type: 'CONTRACT' },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByInvoice(userId: string, invoiceId: string) {
    return this.prisma.document.findFirst({
      where: { userId, invoiceId },
    });
  }

  findSongListForBooking(userId: string, bookingId: string) {
    return this.prisma.document.findFirst({
      where: { userId, bookingId, type: 'SONG_LIST' },
    });
  }

  delete(id: string) {
    return this.prisma.document.delete({ where: { id } });
  }
}
