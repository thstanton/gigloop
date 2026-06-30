import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { UpdateBookingPackageDto } from './dto/update-booking-package.dto';
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

// The shape Copy Event clones from — the source booking loaded with the relations
// cloneBookingCore re-creates (#507).
export type BookingForClone = NonNullable<
  Awaited<ReturnType<BookingsRepository['findOneForClone']>>
>;

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

// The booking list is the highest-frequency, unpaginated endpoint, so it uses a top-level
// `select` to return only the scalars the list renders (#588). Deliberately omitted: the
// `logistics` JSON, `notes`, and `portalToken` (the last also a mild data-exposure smell) —
// none are read by the list UI and all live on BookingDetail instead.
const listSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  eventType: true,
  date: true,
  title: true,
  fee: true,
  customerId: true,
  venueId: true,
  bookingAgentId: true,
  seriesId: true,
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
      select: listSelect,
      orderBy: { date: 'asc' },
    });
  }

  findOne(userId: string, id: string) {
    return this.prisma.booking.findFirst({
      where: { id, userId },
      include: bookingIncludes,
    });
  }

  // Loads everything Copy Event clones (#507): the full booking-owned Packages + their
  // PerformanceSets, the music form config (not the response), and the checklist. SKIPPED
  // items are dropped — they mirror the original gig's "not needed here" decision, and the
  // copy starts from the checklist the musician actually sees (ADR-0049).
  findOneForClone(userId: string, id: string) {
    return this.prisma.booking.findFirst({
      where: { id, userId },
      include: {
        packages: { orderBy: { order: 'asc' } },
        sets: { orderBy: { order: 'asc' } },
        musicFormConfig: true,
        checklistItems: { where: { state: { not: 'SKIPPED' } }, orderBy: { order: 'asc' } },
      },
    });
  }

  // Clones the booking row + packages + sets + music form config for Copy Event (#507).
  // Lifecycle state is deliberately NOT copied: status is set to CONFIRMED (a copied series
  // gig is "the same booking again" — already committed, so it skips the enquiry walk), a
  // fresh portalToken + createdAt come from Prisma defaults (so they are omitted here), and
  // depositReceivedAt stays null. The customer-submitted music form *response* is never
  // cloned. Checklist seeding is orchestrated by the service (it reuses seedChecklistItems
  // so completion resets and due dates recompute against the new date).
  async cloneBookingCore(
    userId: string,
    source: BookingForClone,
    newDate: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;

    const booking = await db.booking.create({
      data: {
        userId,
        status: BookingStatus.CONFIRMED,
        eventType: source.eventType,
        date: newDate,
        title: source.title,
        ...(source.fee != null ? { fee: source.fee } : {}),
        notes: source.notes,
        travelMode: source.travelMode,
        ...(source.logistics != null ? { logistics: source.logistics as Prisma.InputJsonValue } : {}),
        customerId: source.customerId,
        venueId: source.venueId,
        bookingAgentId: source.bookingAgentId,
        seriesId: source.seriesId,
      },
    });

    // Clone Packages first, mapping old id -> new id so cloned sets can re-point at them.
    const packageIdMap = new Map<string, string>();
    for (const pkg of source.packages) {
      const created = await db.package.create({
        data: { userId, bookingId: booking.id, label: pkg.label, icon: pkg.icon, order: pkg.order },
      });
      packageIdMap.set(pkg.id, created.id);
    }

    // Clone PerformanceSets, including ungrouped sets (packageId === null).
    for (const set of source.sets) {
      await db.performanceSet.create({
        data: {
          userId,
          bookingId: booking.id,
          order: set.order,
          duration: set.duration,
          startTime: set.startTime,
          label: set.label,
          packageId: set.packageId ? (packageIdMap.get(set.packageId) ?? null) : null,
        },
      });
    }

    if (source.musicFormConfig) {
      await db.musicFormConfig.create({
        data: {
          userId,
          bookingId: booking.id,
          enabledGenres: source.musicFormConfig.enabledGenres,
          keyMoments: source.musicFormConfig.keyMoments as Prisma.InputJsonValue,
        },
      });
    }

    return db.booking.findFirstOrThrow({ where: { id: booking.id }, include: bookingIncludes });
  }

  async create(
    userId: string,
    dto: CreateBookingDto,
    enableMusicForm = false,
    tx?: Prisma.TransactionClient,
  ) {
    const { packageTemplateIds: _, fee, date, checklistItems: __, newSeries: ___, enableMusicForm: ____, ...fields } = dto;
    const db = tx ?? this.prisma;
    const data = {
      userId,
      ...fields,
      date: new Date(date),
      ...(fee !== undefined ? { fee } : {}),
    };

    // No packages here, so an enabled music form starts empty (ADR-0046: provenance
    // severed, nothing to seed from; moments are added later or suggested on apply).
    if (!enableMusicForm) {
      return db.booking.create({ data, include: bookingIncludes });
    }

    const booking = await db.booking.create({ data });
    await db.musicFormConfig.create({
      data: { userId, bookingId: booking.id, enabledGenres: [], keyMoments: [] },
    });
    return db.booking.findFirstOrThrow({ where: { id: booking.id }, include: bookingIncludes });
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
    enableMusicForm: boolean,
    tx?: Prisma.TransactionClient,
  ) {
    const { packageTemplateIds: _, fee, date, checklistItems: __, newSeries: ___, enableMusicForm: ____, ...fields } = dto;
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

    // Create music form config when enabled, seeded from the chosen package templates
    if (enableMusicForm) {
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

  async removePackage(bookingId: string, packageId: string, packageLabel: string) {
    // Removing a Package is non-destructive (ADR-0046 / #500 + #502). In one
    // transaction so a booking is never left half-degraded:
    //   - its sets orphan to ungrouped (packageId → null), not deleted;
    //   - its music-form key moments move to the "Other" bucket, not deleted.
    // Key-moment `section` is a snapshot label (ADR-0046), so moments are matched
    // by label. Booking packages may share a label (free rename, #500) — moving
    // both packages' moments to "Other" is an accepted edge, not a silent bug.
    await this.prisma.$transaction(async (tx) => {
      await tx.performanceSet.updateMany({ where: { bookingId, packageId }, data: { packageId: null } });

      const config = await tx.musicFormConfig.findUnique({ where: { bookingId } });
      if (config) {
        const moments = (config.keyMoments as unknown as Array<{ label: string; section: string }>) ?? [];
        if (moments.some((m) => m.section === packageLabel)) {
          const rewritten = moments.map((m) =>
            m.section === packageLabel ? { ...m, section: 'Other' } : m,
          );
          await tx.musicFormConfig.update({
            where: { bookingId },
            data: { keyMoments: rewritten as unknown as Prisma.InputJsonValue },
          });
        }
      }

      await tx.package.delete({ where: { id: packageId } });
    });
    return this.prisma.booking.findFirst({ where: { id: bookingId }, include: bookingIncludes });
  }

  async updatePackage(bookingId: string, packageId: string, dto: UpdateBookingPackageDto) {
    await this.prisma.package.update({ where: { id: packageId }, data: dto });
    return this.prisma.booking.findFirst({ where: { id: bookingId }, include: bookingIncludes });
  }

  findChecklistItems(userId: string, bookingId: string) {
    return this.prisma.bookingChecklistItem.findMany({
      where: { bookingId, userId, state: { not: 'SKIPPED' } },
      orderBy: { order: 'asc' },
      // Multi-step goals carry their steps to the client (ADR-0057); the active step
      // (first non-terminal by order) and the fold are derived on the frontend.
      include: { steps: { orderBy: { order: 'asc' } } },
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
    concern: string | null = null,
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
        concern,
      },
    });
  }

  findChecklistItemById(userId: string, bookingId: string, itemId: string) {
    return this.prisma.bookingChecklistItem.findFirst({
      where: { id: itemId, bookingId, userId },
      select: { key: true },
    });
  }

  // The per-concern "Remind me about" selector must SEE skipped items (to render
  // them as off/re-enableable), unlike findChecklistItems which hides them from the
  // Checklist card. Returns the fields the selector reads, all states included.
  findChecklistItemsForReminders(userId: string, bookingId: string) {
    return this.prisma.bookingChecklistItem.findMany({
      where: { bookingId, userId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        key: true,
        state: true,
        requiredForStatus: true,
        concern: true,
        label: true,
        order: true,
      },
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
