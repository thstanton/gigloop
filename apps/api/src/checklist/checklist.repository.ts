import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ActionChecklistItem = {
  id: string;
  key: string | null;
  label: string;
  state: string;
  dueDate: Date | null;
  requiredForStatus: string | null;
  order: number;
};

@Injectable()
export class ChecklistRepository {
  constructor(private prisma: PrismaService) {}

  async findActionItems(userId: string, today: Date, reminderLeadDays: number) {
    const cutoff = addDays(today, reminderLeadDays);

    const bookings = await this.prisma.booking.findMany({
      where: {
        userId,
        date: { gte: today },
        status: { not: 'CANCELLED' },
      },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        title: true,
        customer: { select: { name: true } },
        venue: { select: { name: true } },
        checklistItems: {
          where: {
            completedBy: 'USER',
            state: { in: ['PENDING', 'FAILED'] },
          },
          select: {
            id: true,
            key: true,
            label: true,
            state: true,
            dueDate: true,
            requiredForStatus: true,
            order: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return bookings
      .map(({ checklistItems, ...booking }) => {
        const surfaced = applySurfacingRules(checklistItems as ActionChecklistItem[], cutoff);
        return surfaced.length > 0 ? { booking, item: surfaced[0] } : null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
  }

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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function applySurfacingRules(items: ActionChecklistItem[], cutoff: Date): ActionChecklistItem[] {
  return items.filter((item) => {
    if (item.dueDate !== null) {
      return item.dueDate <= cutoff;
    }
    if (item.requiredForStatus !== null) {
      const peers = items.filter((i) => i.requiredForStatus === item.requiredForStatus);
      return peers.length === 1;
    }
    return false;
  });
}
