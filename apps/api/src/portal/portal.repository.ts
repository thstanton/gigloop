import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CONTRACT_INCLUDE } from '../bookings/booking.includes';

@Injectable()
export class PortalRepository {
  constructor(private prisma: PrismaService) {}

  findBookingByToken(token: string) {
    return this.prisma.booking.findUnique({
      where: { portalToken: token },
      include: {
        customer: true,
        venue: true,
        sets: {
          orderBy: { order: 'asc' },
        },
        packages: {
          orderBy: { order: 'asc' },
        },
        invoices: {
          where: { status: 'SENT', isDeposit: true },
          include: { lineItems: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        documents: {
          include: {
            invoice: { select: { id: true, invoiceNumber: true, isDeposit: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        musicFormConfig: { select: { id: true, publishedAt: true } },
        musicFormResponse: { select: { id: true } },
        communications: {
          select: {
            sentAt: true,
            template: { select: { builtInType: true } },
          },
        },
        contracts: CONTRACT_INCLUDE,
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
          select: { keyMoments: true, enabledGenres: true, publishedAt: true },
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
}
