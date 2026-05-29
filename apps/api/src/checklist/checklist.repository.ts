import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChecklistRepository {
  constructor(private prisma: PrismaService) {}

  async findItemsWithContext(bookingId: string) {
    const [items, booking] = await Promise.all([
      this.prisma.bookingChecklistItem.findMany({
        where: { bookingId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          userId: true,
          status: true,
          depositReceivedAt: true,
          communications: {
            select: {
              status: true,
              template: { select: { builtInType: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          invoices: {
            where: { status: { not: 'VOID' } },
            select: { isDeposit: true },
          },
          contracts: {
            where: { status: { not: 'VOID' } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true },
          },
          musicFormResponse: { select: { id: true } },
        },
      }),
    ]);
    return { items, booking };
  }

  resetItemByKey(bookingId: string, key: string) {
    return this.prisma.bookingChecklistItem.updateMany({
      where: { bookingId, key, state: 'COMPLETE' },
      data: { state: 'PENDING', completedAt: null },
    });
  }

  updateItemStates(updates: Array<{ id: string; state: string; completedAt?: Date | null }>) {
    if (!updates.length) return Promise.resolve();
    return this.prisma.$transaction(
      updates.map(({ id, state, completedAt }) =>
        this.prisma.bookingChecklistItem.update({
          where: { id },
          data: { state, ...(completedAt !== undefined ? { completedAt } : {}) },
        }),
      ),
    );
  }
}
