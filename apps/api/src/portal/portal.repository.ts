import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SpecialRequestDto } from './dto/submit-music-form.dto';

@Injectable()
export class PortalRepository {
  constructor(private prisma: PrismaService) {}

  findBookingByToken(token: string) {
    return this.prisma.booking.findUnique({
      where: { portalToken: token },
      include: {
        customer: true,
        venue: true,
        sets: { orderBy: { order: 'asc' } },
        invoices: {
          where: { status: 'SENT', isDeposit: true },
          include: { lineItems: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        documents: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, isDeposit: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        musicFormConfig: { select: { id: true } },
        musicFormResponse: { select: { id: true } },
      },
    });
  }

  findMusicFormDataByToken(token: string) {
    return this.prisma.booking.findUnique({
      where: { portalToken: token },
      select: {
        id: true,
        userId: true,
        musicFormConfig: {
          select: { keyMoments: true, enabledGenres: true },
        },
        musicFormResponse: {
          select: {
            selectedSongIds: true,
            specialRequests: true,
            notes: true,
          },
        },
      },
    });
  }

  findSongsByUserId(userId: string, genres: string[]) {
    return this.prisma.song.findMany({
      where: { userId, genre: { in: genres }, active: true },
      select: { id: true, title: true, artist: true, genre: true },
      orderBy: [{ genre: 'asc' }, { title: 'asc' }],
    });
  }

  findAllSongsByUserId(userId: string) {
    return this.prisma.song.findMany({
      where: { userId, active: true },
      select: { id: true, title: true, artist: true, genre: true },
      orderBy: [{ genre: 'asc' }, { title: 'asc' }],
    });
  }

  async upsertMusicFormResponse(
    bookingId: string,
    userId: string,
    selectedSongIds: string[],
    specialRequests: SpecialRequestDto[],
    notes: string | undefined,
  ) {
    return this.prisma.musicFormResponse.upsert({
      where: { bookingId },
      create: {
        bookingId,
        userId,
        selectedSongIds,
        specialRequests: specialRequests as unknown as Prisma.InputJsonValue,
        notes,
        submittedAt: new Date(),
      },
      update: {
        selectedSongIds,
        specialRequests: specialRequests as unknown as Prisma.InputJsonValue,
        notes,
        submittedAt: new Date(),
      },
    });
  }

  findContractTemplate(userId: string) {
    return this.prisma.template.findFirst({
      where: { userId, builtInType: 'contract' },
      select: { content: true },
    });
  }

  findPublicProfile(userId: string) {
    return this.prisma.publicProfile.findUnique({ where: { userId } });
  }

  markContractSigned(bookingId: string, signedFromIp: string) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { contractSignedAt: new Date(), contractSignedFromIp: signedFromIp },
    });
  }

  findDepositInvoice(bookingId: string, userId: string) {
    return this.prisma.invoice.findFirst({
      where: { bookingId, userId, isDeposit: true, status: 'SENT' },
      select: { dueDate: true },
    });
  }
}
