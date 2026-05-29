import { Injectable } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsRepository {
  constructor(private prisma: PrismaService) {}

  create(userId: string, bookingId: string, type: DocumentType, storageKey: string, invoiceId?: string, contractId?: string) {
    return this.prisma.document.create({
      data: { userId, bookingId, type, storageKey, invoiceId, contractId },
    });
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
