import { Injectable } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsRepository {
  constructor(private prisma: PrismaService) {}

  create(userId: string, bookingId: string | undefined, type: DocumentType, storageKey: string, invoiceId?: string, contractId?: string, name?: string) {
    return this.prisma.document.create({
      // @ts-expect-error Prisma generated types require bookingId until the schema migration runs
      data: { userId, bookingId: bookingId ?? null, type, storageKey, invoiceId, contractId, name },
    });
  }

  findById(id: string, userId: string) {
    return this.prisma.document.findFirst({ where: { id, userId } });
  }

  findByBooking(userId: string, bookingId: string) {
    return this.prisma.document.findMany({
      where: { userId, bookingId },
      include: { contract: { select: { status: true } } },
      orderBy: { createdAt: 'asc' },
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
