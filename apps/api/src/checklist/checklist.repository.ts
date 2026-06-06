import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeDueDate } from '../bookings/checklist-defaults';

type ChecklistItemSeed = {
  key?: string | null;
  label: string;
  completedBy?: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';
  dependsOn?: string[];
  autoCompleteRule?: Record<string, unknown> | null;
  requiredForStatus?: string | null;
  dueDateRule?: { basis: 'bookingDate' | 'bookingCreation'; offsetDays: number } | null;
};

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

  seedChecklistItems(
    userId: string,
    bookingId: string,
    defaults: ChecklistItemSeed[],
    bookingDate: Date,
    bookingCreatedAt: Date,
  ) {
    const data = defaults.map((item, idx) => {
      const dependsOn = item.dependsOn ?? [];
      const autoCompleteRule = item.autoCompleteRule ?? null;
      const dueDateRule = item.dueDateRule ?? null;
      return {
        userId,
        bookingId,
        key: item.key ?? null,
        label: item.label,
        completedBy: item.completedBy ?? 'USER',
        state: dependsOn.length > 0 ? 'BLOCKED' : 'PENDING',
        order: idx + 1,
        dependsOn,
        ...(autoCompleteRule !== null
          ? { autoCompleteRule: autoCompleteRule as Prisma.InputJsonValue }
          : {}),
        requiredForStatus: item.requiredForStatus ?? null,
        dueDate: computeDueDate(dueDateRule, bookingDate, bookingCreatedAt),
        ...(dueDateRule !== null
          ? { dueDateRule: dueDateRule as unknown as Prisma.InputJsonValue }
          : {}),
      };
    });
    return this.prisma.bookingChecklistItem.createMany({ data });
  }

  async recomputeChecklistDueDates(bookingId: string, bookingDate: Date, bookingCreatedAt: Date) {
    const items = await this.prisma.bookingChecklistItem.findMany({
      where: { bookingId },
      select: { id: true, dueDateRule: true },
    });
    const toUpdate = items.filter((item) => item.dueDateRule !== null);
    if (!toUpdate.length) return;
    await Promise.all(
      toUpdate.map((item) => {
        const rule = item.dueDateRule as { basis: 'bookingDate' | 'bookingCreation'; offsetDays: number };
        return this.prisma.bookingChecklistItem.update({
          where: { id: item.id },
          data: { dueDate: computeDueDate(rule, bookingDate, bookingCreatedAt) },
        });
      }),
    );
  }

  updateChecklistItemState(userId: string, bookingId: string, itemId: string, state: 'COMPLETE' | 'PENDING') {
    return this.prisma.bookingChecklistItem.updateMany({
      where: { id: itemId, bookingId, userId },
      data: {
        state,
        completedAt: state === 'COMPLETE' ? new Date() : null,
      },
    });
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
