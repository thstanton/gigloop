import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
