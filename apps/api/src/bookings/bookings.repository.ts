import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { UpsertMusicFormConfigDto } from './dto/upsert-music-form-config.dto';
import { computeDueDate } from './checklist-defaults';
import { CONTRACT_INCLUDE } from './booking.includes';

type ChecklistItemSeed = {
  key?: string | null;
  label: string;
  completedBy?: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';
  dependsOn?: string[];
  autoCompleteRule?: Record<string, unknown> | null;
  requiredForStatus?: string | null;
  dueDateRule?: { basis: 'bookingDate' | 'bookingCreation'; offsetDays: number } | null;
};

type FormatWithSlots = {
  id: string;
  label: string;
  keyMoments: string[];
  defaultGenreSelection: string[];
  slots: Array<{ label: string | null; duration: number; order: number }>;
};

const bookingIncludes = {
  customer: true,
  venue: true,
  bookingAgent: true,
  sets: { orderBy: { order: 'asc' as const } },
  performanceFormats: {
    include: {
      performanceFormat: { select: { id: true, label: true, icon: true, keyMoments: true, defaultGenreSelection: true } },
    },
    orderBy: { order: 'asc' as const },
  },
  musicFormConfig: { select: { id: true } },
  musicFormResponse: { select: { id: true } },
  contracts: CONTRACT_INCLUDE,
} as const;

const listIncludes = {
  customer: { select: { id: true, name: true, email: true } },
  venue: { select: { id: true, name: true } },
  bookingAgent: { select: { id: true, name: true } },
  sets: { select: { startTime: true }, orderBy: { order: 'asc' as const }, take: 1 },
} as const;

@Injectable()
export class BookingsRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, status?: BookingStatus) {
    return this.prisma.booking.findMany({
      where: {
        userId,
        status: status !== undefined
          ? status
          : { not: BookingStatus.CANCELLED },
      },
      include: listIncludes,
      orderBy: { date: 'asc' },
    });
  }

  findOne(userId: string, id: string) {
    return this.prisma.booking.findFirst({
      where: { id, userId },
      include: bookingIncludes,
    });
  }

  create(userId: string, dto: CreateBookingDto) {
    const { formatIds: _, fee, date, checklistItems: __, ...fields } = dto;
    return this.prisma.booking.create({
      data: {
        userId,
        ...fields,
        date: new Date(date),
        ...(fee !== undefined ? { fee } : {}),
      },
      include: bookingIncludes,
    });
  }

  findFormats(userId: string, ids: string[]) {
    return this.prisma.performanceFormat.findMany({
      where: { id: { in: ids }, userId },
      include: { slots: { orderBy: { order: 'asc' } } },
    });
  }

  createWithFormats(userId: string, dto: CreateBookingDto, orderedFormats: FormatWithSlots[], songRequestFormEnabled: boolean) {
    const { formatIds: _, fee, date, checklistItems: __, ...fields } = dto;

    let slotOrder = 1;
    const setRecords = orderedFormats.flatMap((fmt) =>
      fmt.slots.map((slot) => ({
        userId,
        order: slotOrder++,
        duration: slot.duration,
        label: slot.label ?? undefined,
        performanceFormatId: fmt.id,
      })),
    );

    const formatRecords = orderedFormats.map((fmt, idx) => ({
      userId,
      order: idx + 1,
      performanceFormatId: fmt.id,
    }));

    const allKeyMoments = orderedFormats.flatMap((fmt) =>
      fmt.keyMoments.map((km) => ({ label: km, section: fmt.label })),
    );
    const allGenres = [...new Set(orderedFormats.flatMap((fmt) => fmt.defaultGenreSelection))];

    return this.prisma.booking.create({
      data: {
        userId,
        ...fields,
        date: new Date(date),
        ...(fee !== undefined ? { fee } : {}),
        sets: setRecords.length ? { create: setRecords } : undefined,
        performanceFormats: { create: formatRecords },
        ...(songRequestFormEnabled
          ? {
              musicFormConfig: {
                create: { userId, enabledGenres: allGenres, keyMoments: allKeyMoments },
              },
            }
          : {}),
      },
      include: bookingIncludes,
    });
  }

  update(id: string, dto: UpdateBookingDto) {
    const { date, ...rest } = dto;
    return this.prisma.booking.update({
      where: { id },
      data: {
        ...rest,
        ...(date !== undefined ? { date: new Date(date) } : {}),
      },
      include: bookingIncludes,
    });
  }

  cancel(id: string) {
    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  findSet(userId: string, bookingId: string, setId: string) {
    return this.prisma.performanceSet.findFirst({
      where: { id: setId, bookingId, userId },
    });
  }

  addSet(userId: string, bookingId: string, dto: CreateSetDto) {
    return this.prisma.performanceSet.create({
      data: { userId, bookingId, ...dto },
    });
  }

  updateSet(setId: string, dto: UpdateSetDto) {
    return this.prisma.performanceSet.update({
      where: { id: setId },
      data: dto,
    });
  }

  deleteSet(setId: string) {
    return this.prisma.performanceSet.delete({
      where: { id: setId },
    });
  }

  findBookingsForActions(userId: string, from: Date, to: Date) {
    return this.prisma.booking.findMany({
      where: {
        userId,
        status: { not: BookingStatus.CANCELLED },
        date: { gte: from, lte: to },
      },
      include: {
        customer: { select: { name: true } },
        venue: { select: { name: true } },
        invoices: { select: { isDeposit: true, status: true } },
        communications: {
          select: { status: true, template: { select: { builtInType: true } } },
        },
        musicFormConfig: { select: { id: true } },
        musicFormResponse: { select: { id: true } },
        contracts: {
          where: { status: { not: 'VOID' } },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: { status: true, signedAt: true },
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  findUserProfile(userId: string) {
    return this.prisma.userProfile.findUnique({ where: { userId } });
  }

  findMusicFormConfig(bookingId: string) {
    return this.prisma.musicFormConfig.findUnique({ where: { bookingId } });
  }

  findMusicFormResponse(userId: string, bookingId: string) {
    return this.prisma.musicFormResponse.findUnique({
      where: { bookingId },
      select: {
        selectedSongIds: true,
        specialRequests: true,
        notes: true,
        submittedAt: true,
        booking: { select: { userId: true } },
      },
    });
  }

  findSongsByIds(userId: string, ids: string[]) {
    return this.prisma.song.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, title: true, artist: true, genre: true },
    });
  }

  upsertMusicFormConfig(userId: string, bookingId: string, dto: UpsertMusicFormConfigDto) {
    return this.prisma.musicFormConfig.upsert({
      where: { bookingId },
      create: { userId, bookingId, keyMoments: dto.keyMoments as unknown as Prisma.InputJsonValue, enabledGenres: dto.enabledGenres },
      update: { keyMoments: dto.keyMoments as unknown as Prisma.InputJsonValue, enabledGenres: dto.enabledGenres },
    });
  }

  findBookingFormat(userId: string, bookingId: string, bookingFormatId: string) {
    return this.prisma.bookingPerformanceFormat.findFirst({
      where: { id: bookingFormatId, bookingId, userId },
    });
  }

  async applyFormat(userId: string, bookingId: string, format: FormatWithSlots) {
    const [existingFormats, existingSets] = await Promise.all([
      this.prisma.bookingPerformanceFormat.findMany({ where: { bookingId }, select: { order: true } }),
      this.prisma.performanceSet.findMany({ where: { bookingId }, select: { order: true } }),
    ]);
    const nextFormatOrder = existingFormats.length
      ? Math.max(...existingFormats.map((f) => f.order)) + 1
      : 1;
    const nextSetOrder = existingSets.length
      ? Math.max(...existingSets.map((s) => s.order)) + 1
      : 1;

    await this.prisma.$transaction([
      this.prisma.bookingPerformanceFormat.create({
        data: { userId, bookingId, order: nextFormatOrder, performanceFormatId: format.id },
      }),
      ...format.slots.map((slot, idx) =>
        this.prisma.performanceSet.create({
          data: {
            userId,
            bookingId,
            order: nextSetOrder + idx,
            duration: slot.duration,
            label: slot.label ?? undefined,
            performanceFormatId: format.id,
          },
        }),
      ),
    ]);

    return this.prisma.booking.findFirst({ where: { id: bookingId }, include: bookingIncludes });
  }

  async removeFormat(bookingId: string, bookingFormatId: string, performanceFormatId: string) {
    await this.prisma.$transaction([
      this.prisma.performanceSet.deleteMany({ where: { bookingId, performanceFormatId } }),
      this.prisma.bookingPerformanceFormat.delete({ where: { id: bookingFormatId } }),
    ]);
    return this.prisma.booking.findFirst({ where: { id: bookingId }, include: bookingIncludes });
  }

  findContractTemplate(userId: string) {
    return this.prisma.template.findFirst({
      where: { userId, builtInType: 'contract' },
      select: { content: true },
    });
  }

  findActiveContract(bookingId: string) {
    return this.prisma.contract.findFirst({
      where: { bookingId, status: { not: 'VOID' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  createContractRecord(userId: string, bookingId: string, content: unknown) {
    return this.prisma.contract.create({
      data: {
        userId,
        bookingId,
        status: 'DRAFT',
        content: content as Prisma.InputJsonValue,
      },
    });
  }

  markContractSent(contractId: string) {
    return this.prisma.contract.update({
      where: { id: contractId },
      data: { status: 'SENT' },
    });
  }

  voidContract(contractId: string) {
    return this.prisma.contract.update({
      where: { id: contractId },
      data: { status: 'VOID', voidedAt: new Date() },
    });
  }

  updateContract(contractId: string, dto: UpdateContractDto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (dto.content !== undefined) data.content = dto.content as Prisma.InputJsonValue;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.signedAt !== undefined) data.signedAt = new Date(dto.signedAt);
    if (dto.status === 'VOID') data.voidedAt = new Date();
    return this.prisma.contract.update({ where: { id: contractId }, data });
  }

  findContractById(userId: string, bookingId: string, contractId: string) {
    return this.prisma.contract.findFirst({
      where: { id: contractId, bookingId, userId },
    });
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

  findChecklistItems(userId: string, bookingId: string) {
    return this.prisma.bookingChecklistItem.findMany({
      where: { bookingId, userId, state: { not: 'SKIPPED' } },
      orderBy: { order: 'asc' },
    });
  }

  async getMaxChecklistOrder(bookingId: string): Promise<number> {
    const result = await this.prisma.bookingChecklistItem.aggregate({
      where: { bookingId },
      _max: { order: true },
    });
    return result._max.order ?? 0;
  }

  createChecklistItem(
    userId: string,
    bookingId: string,
    label: string,
    requiredForStatus: string | null,
    dueDate: Date | null,
    order: number,
  ) {
    return this.prisma.bookingChecklistItem.create({
      data: {
        userId,
        bookingId,
        key: null,
        label,
        completedBy: 'USER',
        state: 'PENDING',
        order,
        dependsOn: [],
        requiredForStatus,
        dueDate,
      },
    });
  }

  findChecklistItemById(userId: string, bookingId: string, itemId: string) {
    return this.prisma.bookingChecklistItem.findFirst({
      where: { id: itemId, bookingId, userId },
      select: { key: true },
    });
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

  setDepositReceivedAt(bookingId: string, date: Date) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { depositReceivedAt: date },
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
}
