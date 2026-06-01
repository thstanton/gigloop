import { Injectable } from '@nestjs/common';
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
}
