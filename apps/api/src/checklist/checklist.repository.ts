import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CHECKLIST_DEFAULTS,
  computeDueDate,
  computeReminderInsertOrder,
} from '../bookings/checklist-defaults';
import { addDays, surfaceActionItems } from './checklist-surfacing';

export type ChecklistItemSeed = {
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
        status: true,
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
        const surfaced = surfaceActionItems(
          checklistItems as ActionChecklistItem[],
          booking.status,
          cutoff,
        );
        return surfaced.length > 0 ? { booking, item: surfaced[0] } : null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
  }

  async findItemsWithContext(bookingId: string) {
    const [items, raw] = await Promise.all([
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
          venueId: true,
          customerId: true,
          depositReceivedAt: true,
          logistics: true,
          _count: { select: { sets: true } },
          communications: {
            select: {
              status: true,
              template: { select: { builtInType: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          invoices: {
            // Only ISSUED, SENT, and PAID invoices satisfy the invoiceExists checklist rule.
            // DRAFT (scratchpad) and VOID are excluded.
            where: { status: { notIn: ['VOID', 'DRAFT'] } },
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
    const booking = raw ? { ...raw, setsCount: raw._count.sets } : null;
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
    tx?: Prisma.TransactionClient,
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
    return (tx ?? this.prisma).bookingChecklistItem.createMany({ data });
  }

  // On-demand seed of a single system reminder (ADR-0052 / PRD #538 Module 4):
  // materialise one BookingChecklistItem from the defaults for a `key` that has no
  // record yet. Idempotent — if the key already exists on the booking it returns the
  // existing item untouched. The new item lands in template (workflow) position: the
  // tail of items at-or-after that position is shifted by +1, inside one transaction.
  async seedReminderItem(
    userId: string,
    bookingId: string,
    key: string,
    bookingDate: Date,
    bookingCreatedAt: Date,
  ): Promise<{ id: string } & Record<string, unknown>> {
    const existing = await this.prisma.bookingChecklistItem.findFirst({
      where: { bookingId, key },
    });
    if (existing) return existing;

    const def = CHECKLIST_DEFAULTS.find((d) => d.key === key);
    if (!def) {
      throw new Error(`Unknown reminder key: ${key}`);
    }

    const allItems = await this.prisma.bookingChecklistItem.findMany({
      where: { bookingId },
      select: { key: true, order: true },
    });
    const insertOrder = computeReminderInsertOrder(key, allItems);

    const dependsOn = def.dependsOn ?? [];
    const autoCompleteRule = def.autoCompleteRule ?? null;
    const dueDateRule = def.dueDateRule ?? null;

    return this.prisma.$transaction(async (tx) => {
      await tx.bookingChecklistItem.updateMany({
        where: { bookingId, order: { gte: insertOrder } },
        data: { order: { increment: 1 } },
      });
      return tx.bookingChecklistItem.create({
        data: {
          userId,
          bookingId,
          key: def.key,
          label: def.label,
          completedBy: def.completedBy ?? 'USER',
          state: dependsOn.length > 0 ? 'BLOCKED' : 'PENDING',
          order: insertOrder,
          dependsOn,
          ...(autoCompleteRule !== null
            ? { autoCompleteRule: autoCompleteRule as Prisma.InputJsonValue }
            : {}),
          requiredForStatus: def.requiredForStatus ?? null,
          dueDate: computeDueDate(dueDateRule, bookingDate, bookingCreatedAt),
          ...(dueDateRule !== null
            ? { dueDateRule: dueDateRule as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });
    });
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

  updateChecklistItemState(
    userId: string,
    bookingId: string,
    itemId: string,
    state: 'COMPLETE' | 'PENDING' | 'SKIPPED',
  ) {
    return this.prisma.bookingChecklistItem.updateMany({
      where: { id: itemId, bookingId, userId },
      data: {
        state,
        completedAt: state === 'COMPLETE' ? new Date() : null,
      },
    });
  }

  // Look up a single checklist item by its system `key` on a booking (used by the
  // enable-reminder flow to decide between un-skip and on-demand seed).
  findItemByKey(bookingId: string, key: string) {
    return this.prisma.bookingChecklistItem.findFirst({
      where: { bookingId, key },
      select: { id: true, state: true },
    });
  }
}
