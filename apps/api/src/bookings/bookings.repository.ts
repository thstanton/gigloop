import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { CONTRACT_INCLUDE } from './booking.includes';
import { buildBookingSearchWhere } from './booking-search';

type PackageTemplateWithSlots = {
  id: string;
  label: string;
  icon: string;
  keyMoments: string[];
  defaultGenreSelection: string[];
  slots: Array<{ label: string | null; duration: number; order: number }>;
};

const bookingIncludes = {
  customer: true,
  venue: true,
  bookingAgent: true,
  series: { select: { id: true, label: true } },
  sets: { orderBy: { order: 'asc' as const } },
  packages: {
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
  series: { select: { id: true, label: true } },
} as const;

@Injectable()
export class BookingsRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, statuses: BookingStatus[] = [], q?: string, eventType?: string, from?: string, to?: string) {
    return this.prisma.booking.findMany({
      where: buildBookingSearchWhere(userId, q, statuses, eventType, from, to),
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

  create(userId: string, dto: CreateBookingDto, tx?: Prisma.TransactionClient) {
    const { packageTemplateIds: _, fee, date, checklistItems: __, newSeries: ___, ...fields } = dto;
    return (tx ?? this.prisma).booking.create({
      data: {
        userId,
        ...fields,
        date: new Date(date),
        ...(fee !== undefined ? { fee } : {}),
      },
      include: bookingIncludes,
    });
  }

  findPackageTemplates(userId: string, ids: string[]) {
    return this.prisma.packageTemplate.findMany({
      where: { id: { in: ids }, userId },
      include: { slots: { orderBy: { order: 'asc' } } },
    });
  }

  async createWithPackageTemplates(
    userId: string,
    dto: CreateBookingDto,
    orderedTemplates: PackageTemplateWithSlots[],
    songRequestFormEnabled: boolean,
    tx?: Prisma.TransactionClient,
  ) {
    const { packageTemplateIds: _, fee, date, checklistItems: __, newSeries: ___, ...fields } = dto;
    const db = tx ?? this.prisma;

    // Create the booking row first (no sets, no packages yet)
    const booking = await db.booking.create({
      data: {
        userId,
        ...fields,
        date: new Date(date),
        ...(fee !== undefined ? { fee } : {}),
      },
    });

    // Create booking-owned Package rows (snapshot label + icon from template)
    const bookingPackages: Array<{ id: string }> = [];
    for (let i = 0; i < orderedTemplates.length; i++) {
      const tmpl = orderedTemplates[i];
      const pkg = await db.package.create({
        data: { userId, bookingId: booking.id, order: i + 1, label: tmpl.label, icon: tmpl.icon },
      });
      bookingPackages.push(pkg);
    }

    // Create sets referencing the booking-owned Package IDs
    let slotOrder = 1;
    for (let tIdx = 0; tIdx < orderedTemplates.length; tIdx++) {
      for (const slot of orderedTemplates[tIdx].slots) {
        await db.performanceSet.create({
          data: {
            userId,
            bookingId: booking.id,
            order: slotOrder++,
            duration: slot.duration,
            label: slot.label ?? undefined,
            packageId: bookingPackages[tIdx].id,
          },
        });
      }
    }

    // Create music form config when enabled
    if (songRequestFormEnabled) {
      const allKeyMoments = orderedTemplates.flatMap((tmpl) =>
        tmpl.keyMoments.map((km) => ({ label: km, section: tmpl.label })),
      );
      const allGenres = [...new Set(orderedTemplates.flatMap((tmpl) => tmpl.defaultGenreSelection))];
      await db.musicFormConfig.create({
        data: { userId, bookingId: booking.id, enabledGenres: allGenres, keyMoments: allKeyMoments },
      });
    }

    return db.booking.findFirstOrThrow({ where: { id: booking.id }, include: bookingIncludes });
  }

  update(id: string, dto: UpdateBookingDto) {
    const { date, logistics, ...rest } = dto;
    return this.prisma.booking.update({
      where: { id },
      data: {
        ...rest,
        ...(date !== undefined ? { date: new Date(date) } : {}),
        ...(logistics !== undefined ? { logistics: logistics as Prisma.InputJsonValue } : {}),
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

  findBookingPackage(userId: string, bookingId: string, packageId: string) {
    return this.prisma.package.findFirst({
      where: { id: packageId, bookingId, userId },
    });
  }

  async applyPackageTemplate(userId: string, bookingId: string, template: PackageTemplateWithSlots) {
    const [existingPackages, existingSets] = await Promise.all([
      this.prisma.package.findMany({ where: { bookingId }, select: { order: true } }),
      this.prisma.performanceSet.findMany({ where: { bookingId }, select: { order: true } }),
    ]);
    const nextPackageOrder = existingPackages.length
      ? Math.max(...existingPackages.map((p) => p.order)) + 1
      : 1;
    const nextSetOrder = existingSets.length
      ? Math.max(...existingSets.map((s) => s.order)) + 1
      : 1;

    // Create booking-owned Package + sets atomically
    await this.prisma.$transaction(async (tx) => {
      const bookingPackage = await tx.package.create({
        data: { userId, bookingId, order: nextPackageOrder, label: template.label, icon: template.icon },
      });
      for (let i = 0; i < template.slots.length; i++) {
        const slot = template.slots[i];
        await tx.performanceSet.create({
          data: {
            userId,
            bookingId,
            order: nextSetOrder + i,
            duration: slot.duration,
            label: slot.label ?? undefined,
            packageId: bookingPackage.id,
          },
        });
      }
    });

    return this.prisma.booking.findFirst({ where: { id: bookingId }, include: bookingIncludes });
  }

  async removePackage(bookingId: string, packageId: string) {
    await this.prisma.$transaction([
      this.prisma.performanceSet.deleteMany({ where: { bookingId, packageId } }),
      this.prisma.package.delete({ where: { id: packageId } }),
    ]);
    return this.prisma.booking.findFirst({ where: { id: bookingId }, include: bookingIncludes });
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

  setDepositReceivedAt(bookingId: string, date: Date) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { depositReceivedAt: date },
    });
  }

  clearDepositReceivedAt(bookingId: string) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { depositReceivedAt: null },
    });
  }

  countNonVoidInvoices(bookingId: string) {
    return this.prisma.invoice.count({
      where: { bookingId, status: { not: 'VOID' } },
    });
  }

  updateSeries(bookingId: string, seriesId: string | null) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { seriesId },
      include: bookingIncludes,
    });
  }
}
