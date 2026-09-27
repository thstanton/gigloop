import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { UpdateBookingPackageDto } from './dto/update-booking-package.dto';
import { CreateChairDto } from './dto/create-chair.dto';
import { UpdateChairDto } from './dto/update-chair.dto';
import { CONTRACT_INCLUDE, NESTED_CONTACT_SELECT } from './booking.includes';
import { buildBookingSearchWhere } from './booking-search';
import { INITIAL_BAND_MEMBER_STATUS } from './band-member-status';

// Band members v1 (#879, ADR-0072 §3): carries the default lineup so applyPackageTemplate (#884)
// and createWithPackageTemplates (#988) can both auto-apply it alongside the sets — null when
// the template has none. Chairs created this way are inert (memberId: null, no member row, no
// bandPortalToken, no fee) — ADR-0066's create-mode exclusion forbids a contact PATCH firing
// from inside the atomic POST, not a roster existing at creation (Copy Event has carried a full
// roster at t=0 since #879).
type PackageTemplateWithSlots = {
  id: string;
  label: string;
  icon: string;
  keyMoments: string[];
  defaultGenreSelection: string[];
  slots: Array<{ label: string | null; duration: number; order: number }>;
  defaultLineupTemplate: { id: string; label: string; slots: Array<{ role: string; order: number }> } | null;
};

type LineupTemplateWithSlots = NonNullable<PackageTemplateWithSlots['defaultLineupTemplate']>;

// #989: the musician's resolved lineup declarations for create — one entry per Lineup to write,
// each already carrying its full template (bulk-fetched by the service before the transaction
// opens, mirroring `orderedTemplates`). `packageTemplateIds` names by *template* id, since the
// booking-owned Package rows don't exist yet when the musician made the choice.
export type LineupSelection = {
  lineupTemplate: LineupTemplateWithSlots;
  packageTemplateIds: string[];
};

// The shape Copy Event clones from — the source booking loaded with the relations
// cloneBookingCore re-creates (#507).
export type BookingForClone = NonNullable<
  Awaited<ReturnType<BookingsRepository['findOneForClone']>>
>;

// Narrowed to exactly what `BookingPerformanceSetDto` declares (ADR-0071 / #873) — no `userId`.
export const setSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  bookingId: true,
  order: true,
  duration: true,
  startTime: true,
  label: true,
  packageId: true,
} as const;

// Narrowed to exactly what `BookingPackageDto` declares (ADR-0071 / #873) — no `userId`.
export const packageSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  bookingId: true,
  label: true,
  icon: true,
  order: true,
} as const;

// Narrowed to exactly what `BookingBandChairDto` declares minus its one derived field, `callTime`
// (ADR-0072 §2 / #884, re-pointed by ADR-0081 §3) — no `userId`. `callTime` is never selected: it
// is computed in BookingsService.mapBooking from this chair's Lineup's segments against the
// booking's `sets`, never stored (a stored copy drifts the first time a set moves).
export const bandChairSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  bookingId: true,
  role: true,
  order: true,
  lineupId: true,
  memberId: true,
} as const;

// `order` is per-Lineup (ADR-0081) — chairs in different Lineups routinely tie on it (both start
// at 1), so `createdAt` breaks the tie deterministically. Without it, Postgres gives no guarantee
// on tied rows' relative order, and the vacant-chair list could visibly reshuffle between refetches.
// Declared outside the `as const` selects below so it stays a mutable array Prisma's `orderBy` accepts.
const bandChairOrderBy: Prisma.BookingBandChairOrderByWithRelationInput[] = [{ order: 'asc' }, { createdAt: 'asc' }];

// Narrowed to exactly what `BookingLineupDto` declares minus its one derived field, `packageIds`
// (ADR-0081 §4) — no `userId`. `packageIds` is never selected as a flat column: it is mapped in
// BookingsService.mapBooking from the `packages` join rows below, which the wire never carries
// as-is (a join-row shape leaks the `LineupPackage` implementation detail).
export const lineupSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  bookingId: true,
  label: true,
  packages: { select: { packageId: true } },
} as const;

// Narrowed to exactly what `BookingBandMemberDto` declares (ADR-0072 §2/§5 / #885) — no `userId`,
// `removedAt` excluded from the wire entirely (see the query's `where` below). `contact` mirrors
// the inline id/name/email shape `listSelect` already nests for customer/venue/bookingAgent.
export const bandMemberSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  bookingId: true,
  contactId: true,
  contact: { select: { id: true, name: true, email: true } },
  bandPortalToken: true,
  status: true,
  isSelf: true,
  sessionFee: true,
  invitedAt: true,
  respondedAt: true,
} as const;

// The shape every read and write method below returns (ADR-0071 / #873): an explicit `select`
// mirroring `BookingResponseDto` field-for-field — `userId` excluded at every level (top-level
// booking, nested contacts, sets, packages). Every method that returns a booking uses
// `bookingDetailSelect` so this one type describes all of them.
export const bookingDetailSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  eventType: true,
  date: true,
  title: true,
  fee: true,
  notes: true,
  portalToken: true,
  travelMode: true,
  logistics: true,
  customerId: true,
  customer: { select: NESTED_CONTACT_SELECT },
  venueId: true,
  venue: { select: NESTED_CONTACT_SELECT },
  bookingAgentId: true,
  bookingAgent: { select: NESTED_CONTACT_SELECT },
  seriesId: true,
  series: { select: { id: true, label: true } },
  sets: { select: setSelect, orderBy: { order: 'asc' as const } },
  packages: { select: packageSelect, orderBy: { order: 'asc' as const } },
  lineups: { select: lineupSelect, orderBy: { createdAt: 'asc' as const } },
  bandChairs: { select: bandChairSelect, orderBy: bandChairOrderBy },
  // Removed rows never reach the wire (ADR-0072 §5) — filtered at the query, not in mapBooking, so
  // the DTO's `select` contract (booking-select-contract.spec.ts) stays exact.
  bandMembers: { where: { removedAt: null }, select: bandMemberSelect, orderBy: { createdAt: 'asc' as const } },
  musicFormConfig: { select: { id: true, publishedAt: true } },
  musicFormResponse: { select: { id: true } },
  contracts: CONTRACT_INCLUDE,
} as const;

export type BookingDetailRow = Prisma.BookingGetPayload<{ select: typeof bookingDetailSelect }>;

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
      select: bookingDetailSelect,
    });
  }

  // Lightweight tenancy probe (#589): the smallest query that confirms a booking belongs
  // to this user, with no relation hydration. It still issues a real DB round-trip, so the
  // Neon scale-to-zero compute warm-up the deep findOne incidentally provided is preserved
  // (#612) — only the over-fetched columns/joins are dropped.
  findForOwnership(userId: string, id: string) {
    return this.prisma.booking.findFirst({
      where: { id, userId },
      select: { id: true, userId: true },
    });
  }

  // Loads everything Copy Event clones (#507): the full booking-owned Packages + their
  // PerformanceSets, the music form config (not the response), and the checklist. SKIPPED
  // items are dropped — they mirror the original gig's "not needed here" decision, and the
  // copy starts from the checklist the musician actually sees (ADR-0049). Band members v1
  // (#879, #889): lineups + bandChairs + bandMembers join the same clone, mirroring
  // bookingDetailSelect's `removedAt: null` filter on members — a soft-removed member is never a
  // candidate to copy. `lineups.packages` carries each Lineup's segment links (ADR-0081 §4).
  findOneForClone(userId: string, id: string) {
    return this.prisma.booking.findFirst({
      where: { id, userId },
      include: {
        packages: { orderBy: { order: 'asc' } },
        sets: { orderBy: { order: 'asc' } },
        lineups: { include: { packages: true }, orderBy: { createdAt: 'asc' } },
        bandChairs: { orderBy: bandChairOrderBy },
        bandMembers: { where: { removedAt: null }, orderBy: { createdAt: 'asc' } },
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

    // Clone Packages first, mapping old id -> new id so cloned sets, Lineup links and band chairs
    // can re-point at them.
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

    // Clone the band roster (#889, ADR-0072 §5) — members before chairs, so chairs can re-point
    // at the cloned member ids.
    await this.cloneBandRoster(db, userId, booking.id, source, packageIdMap);

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

    return db.booking.findFirstOrThrow({ where: { id: booking.id }, select: bookingDetailSelect });
  }

  // Clones a source booking's band roster onto the newly-created clone (#889, ADR-0072 §5; Lineups
  // per ADR-0081). `source.bandMembers` already excludes soft-removed rows (findOneForClone's
  // `removedAt: null` filter) — a copy invites nobody, so status resets to ADDED and the
  // invite/response timestamps stay null; a fresh `bandPortalToken` comes from Prisma's
  // `@default(uuid())` (omitted here) so no token is ever shared with the source gig.
  // `sessionFee`/`isSelf` carry across untouched. A chair whose member was soft-removed (so absent
  // from the id map) comes across as a vacancy, not a dangling reference — the seat survives, the
  // occupant does not. Lineups clone before chairs, mapping old id -> new id so chairs can
  // re-point; each Lineup's segment links re-point at the cloned Package ids.
  private async cloneBandRoster(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    newBookingId: string,
    source: BookingForClone,
    packageIdMap: Map<string, string>,
  ) {
    const memberIdMap = new Map<string, string>();
    for (const member of source.bandMembers) {
      const created = await db.bookingBandMember.create({
        data: {
          userId,
          bookingId: newBookingId,
          contactId: member.contactId,
          status: INITIAL_BAND_MEMBER_STATUS,
          isSelf: member.isSelf,
          ...(member.sessionFee != null ? { sessionFee: member.sessionFee } : {}),
        },
      });
      memberIdMap.set(member.id, created.id);
    }

    const lineupIdMap = new Map<string, string>();
    for (const lineup of source.lineups) {
      const created = await db.lineup.create({
        data: { userId, bookingId: newBookingId, label: lineup.label },
      });
      lineupIdMap.set(lineup.id, created.id);
      for (const link of lineup.packages) {
        const newPackageId = packageIdMap.get(link.packageId);
        if (newPackageId) {
          await db.lineupPackage.create({ data: { userId, lineupId: created.id, packageId: newPackageId } });
        }
      }
    }

    if (source.bandChairs.length > 0) {
      await db.bookingBandChair.createMany({
        data: source.bandChairs.map((chair) => ({
          userId,
          bookingId: newBookingId,
          role: chair.role,
          order: chair.order,
          lineupId: lineupIdMap.get(chair.lineupId)!,
          memberId: chair.memberId ? (memberIdMap.get(chair.memberId) ?? null) : null,
        })),
      });
    }
  }

  async create(
    userId: string,
    dto: CreateBookingDto,
    enableMusicForm = false,
    tx?: Prisma.TransactionClient,
  ) {
    // `lineups` is stripped even though this path is only reached when it's empty/absent (#989:
    // the service routes any non-empty `lineups` through createWithPackageTemplates) — an
    // explicit `lineups: []` ("Decide later" with no packages) still reaches here and must not
    // leak into `data` below.
    const {
      packageTemplateIds: _, fee, date, checklistItems: __, newSeries: ___, enableMusicForm: ____,
      lineups: _____, ...fields
    } = dto;
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
      return db.booking.create({ data, select: bookingDetailSelect });
    }

    const booking = await db.booking.create({ data });
    await db.musicFormConfig.create({
      data: { userId, bookingId: booking.id, enabledGenres: [], keyMoments: [] },
    });
    return db.booking.findFirstOrThrow({ where: { id: booking.id }, select: bookingDetailSelect });
  }

  findPackageTemplates(userId: string, ids: string[]) {
    return this.prisma.packageTemplate.findMany({
      where: { id: { in: ids }, userId },
      include: {
        slots: { orderBy: { order: 'asc' } },
        defaultLineupTemplate: { include: { slots: { orderBy: { order: 'asc' } } } },
      },
    });
  }

  // #988: one Lineup per distinct default lineup template among `orderedTemplates`, linked to
  // every booking-owned package whose template picked it — templates sharing a lineup share the
  // one row (ADR-0081 §4), never a heuristic dedupe. `bookingPackages[i]` is the package created
  // from `orderedTemplates[i]`, so the two arrays are index-aligned.
  private async createLineupsFromTemplates(
    ctx: { db: Prisma.TransactionClient | PrismaService; userId: string; bookingId: string },
    orderedTemplates: PackageTemplateWithSlots[],
    bookingPackages: Array<{ id: string }>,
  ) {
    const { db, userId } = ctx;
    const lineupIdByTemplateId = new Map<string, string>();
    for (let tIdx = 0; tIdx < orderedTemplates.length; tIdx++) {
      const lineupTemplate = orderedTemplates[tIdx].defaultLineupTemplate;
      if (!lineupTemplate) continue;

      let lineupId = lineupIdByTemplateId.get(lineupTemplate.id);
      if (!lineupId) {
        lineupId = await this.createLineupWithChairs(ctx, lineupTemplate);
        lineupIdByTemplateId.set(lineupTemplate.id, lineupId);
      }
      await db.lineupPackage.create({
        data: { userId, lineupId, packageId: bookingPackages[tIdx].id },
      });
    }
  }

  // #989: the musician-declared path — `lineupSelections` is authoritative and fully supersedes
  // every template's own default, including templates left un-mentioned (that's what "Decide
  // later" for one package while another gets a lineup means). One Lineup per entry, even if two
  // entries name the same lineup template — grouping states "same band, both segments" on the
  // wire directly, so the server trusts it rather than re-deriving the dedupe itself (ADR-0081 §4).
  private async createLineupsFromSelections(
    ctx: { db: Prisma.TransactionClient | PrismaService; userId: string; bookingId: string },
    lineupSelections: LineupSelection[],
    orderedTemplates: PackageTemplateWithSlots[],
    bookingPackages: Array<{ id: string }>,
  ) {
    const { db, userId } = ctx;
    const packageIdByTemplateId = new Map(orderedTemplates.map((t, i) => [t.id, bookingPackages[i].id]));
    for (const selection of lineupSelections) {
      const lineupId = await this.createLineupWithChairs(ctx, selection.lineupTemplate);
      for (const templateId of selection.packageTemplateIds) {
        const packageId = packageIdByTemplateId.get(templateId);
        if (!packageId) continue; // not among this booking's chosen packages — ignore rather than throw
        await db.lineupPackage.create({ data: { userId, lineupId, packageId } });
      }
    }
  }

  private async createLineupWithChairs(
    ctx: { db: Prisma.TransactionClient | PrismaService; userId: string; bookingId: string },
    lineupTemplate: LineupTemplateWithSlots,
  ): Promise<string> {
    const { db, userId, bookingId } = ctx;
    const lineup = await db.lineup.create({
      data: { userId, bookingId, label: lineupTemplate.label },
    });
    await db.bookingBandChair.createMany({
      data: lineupTemplate.slots.map((slot, i) => ({
        userId,
        bookingId,
        lineupId: lineup.id,
        order: i + 1,
        role: slot.role,
      })),
    });
    return lineup.id;
  }

  async createWithPackageTemplates(
    userId: string,
    dto: CreateBookingDto,
    orderedTemplates: PackageTemplateWithSlots[],
    enableMusicForm: boolean,
    tx?: Prisma.TransactionClient,
    // #989: undefined -> derive each template's own default (#988 behavior); [] -> "Decide
    // later", apply nothing; entries -> authoritative, supersedes every template default.
    lineupSelections?: LineupSelection[],
  ) {
    const {
      packageTemplateIds: _, fee, date, checklistItems: __, newSeries: ___, enableMusicForm: ____,
      lineups: _____, ...fields
    } = dto;
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

    // Create Lineups (#988, superseded by #989 whenever the musician declared choices): written
    // inline against `tx` — never via applyPackageTemplate, which opens its own $transaction and
    // would nest inside this atomic create (exactly what ADR-0047 forbids).
    const ctx = { db, userId, bookingId: booking.id };
    if (lineupSelections) {
      await this.createLineupsFromSelections(ctx, lineupSelections, orderedTemplates, bookingPackages);
    } else {
      await this.createLineupsFromTemplates(ctx, orderedTemplates, bookingPackages);
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

    return db.booking.findFirstOrThrow({ where: { id: booking.id }, select: bookingDetailSelect });
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
      select: bookingDetailSelect,
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
        musicFormConfig: { select: { id: true, publishedAt: true } },
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

    // Create booking-owned Package + sets atomically, auto-applying the template's default
    // lineup (ADR-0072 §3, #884) as a fresh Lineup linked to the new package/segment (ADR-0081 §2)
    // — its label snapshotted exactly as the template's own label/icon are onto the Package. Chair
    // `order` is per-Lineup (ADR-0081), so a brand-new Lineup always starts at 1.
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
      if (template.defaultLineupTemplate) {
        const lineup = await tx.lineup.create({
          data: { userId, bookingId, label: template.defaultLineupTemplate.label },
        });
        await tx.lineupPackage.create({ data: { userId, lineupId: lineup.id, packageId: bookingPackage.id } });
        const slots = template.defaultLineupTemplate.slots;
        await tx.bookingBandChair.createMany({
          data: slots.map((slot, i) => ({ userId, bookingId, lineupId: lineup.id, order: i + 1, role: slot.role })),
        });
      }
    });

    return this.prisma.booking.findFirst({ where: { id: bookingId }, select: bookingDetailSelect });
  }

  findChair(userId: string, bookingId: string, chairId: string) {
    return this.prisma.bookingBandChair.findFirst({
      where: { id: chairId, bookingId, userId },
    });
  }

  findLineup(userId: string, bookingId: string, lineupId: string) {
    return this.prisma.lineup.findFirst({
      where: { id: lineupId, bookingId, userId },
    });
  }

  // #987 retired `findOrCreateLineupForSegment`. A chair is seated in a Lineup, never in a segment
  // (ADR-0081 §1: only an instance can be pointed at) — the old segment-keyed lookup could not say
  // which band "add a chair to Drinks" meant once two of them played Drinks, and its `packages:
  // { none: {} }` probe could no longer tell the whole-gig band from one that had just lost its
  // last segment. The caller now names the Lineup; omitting it starts a fresh unnamed one.
  addChair(userId: string, bookingId: string, dto: CreateChairDto) {
    return this.prisma.$transaction(async (tx) => {
      const lineupId =
        dto.lineupId ?? (await tx.lineup.create({ data: { userId, bookingId }, select: { id: true } })).id;
      const chairCount = await tx.bookingBandChair.count({ where: { lineupId } });
      return tx.bookingBandChair.create({
        data: { userId, bookingId, lineupId, role: dto.role, order: chairCount + 1 },
      });
    });
  }

  // `previousLineupId` (the chair's lineup before this update, from the caller's prior findChair)
  // is only used to garbage-collect a re-parent's source Lineup if it's now empty — symmetric with
  // deleteChair below, so "an empty Lineup is clutter" holds on every path that can vacate one.
  async updateChair(chairId: string, dto: UpdateChairDto, previousLineupId: string) {
    const updated = await this.prisma.bookingBandChair.update({
      where: { id: chairId }, // scoped-upstream: service.updateChair calls findChair(userId, bookingId, chairId) first, already proving ownership (ADR-0061)
      data: dto,
    });
    if (dto.lineupId && dto.lineupId !== previousLineupId) {
      await this.gcLineupIfEmpty(previousLineupId);
    }
    return updated;
  }

  // Deletes the chair, then garbage-collects its Lineup if that was the last chair it held — an
  // empty Lineup is clutter, not a band (ADR-0081). `lineupId` comes from the caller's prior
  // findChair, already proving ownership.
  async deleteChair(chairId: string, lineupId: string) {
    const deleted = await this.prisma.bookingBandChair.delete({
      where: { id: chairId }, // scoped-upstream: service.deleteChair calls findChair(userId, bookingId, chairId) first, already proving ownership (ADR-0061)
    });
    await this.gcLineupIfEmpty(lineupId);
    return deleted;
  }

  // Shared by deleteChair and updateChair's re-parent path. `lineupId` is always caller-supplied
  // from a chair the caller already owns (ADR-0061) — never derived from unvalidated input here.
  private async gcLineupIfEmpty(lineupId: string): Promise<void> {
    const remaining = await this.prisma.bookingBandChair.count({ where: { lineupId } });
    if (remaining === 0) {
      // deleteMany, not delete: two rapid vacates of a 2-chair lineup can both observe count() ===
      // 0 and race to delete the same Lineup — deleteMany is idempotent where delete would P2025.
      await this.prisma.lineup.deleteMany({
        where: { id: lineupId }, // scoped-upstream: lineupId is the caller's own already-owned chair's field (ADR-0061)
      });
    }
  }

  // The reuse lookup at the heart of ADR-0072 §2: a contact already on this booking's roster (not
  // soft-removed) gets its existing member row, never a second one.
  findActiveMemberByContact(userId: string, bookingId: string, contactId: string) {
    return this.prisma.bookingBandMember.findFirst({
      where: { userId, bookingId, contactId, removedAt: null },
    });
  }

  createMember(userId: string, bookingId: string, contactId: string) {
    return this.prisma.bookingBandMember.create({
      data: { userId, bookingId, contactId },
    });
  }

  setChairMember(chairId: string, memberId: string | null) {
    return this.prisma.bookingBandChair.update({
      where: { id: chairId }, // scoped-upstream: service.assignChair calls findChair(userId, bookingId, chairId) first, already proving ownership (ADR-0061)
      data: { memberId },
    });
  }

  findMember(userId: string, bookingId: string, memberId: string) {
    return this.prisma.bookingBandMember.findFirst({
      where: { id: memberId, bookingId, userId, removedAt: null },
    });
  }

  updateMember(memberId: string, data: Prisma.BookingBandMemberUpdateInput) {
    return this.prisma.bookingBandMember.update({
      where: { id: memberId }, // scoped-upstream: service.updateBandMember calls findMember(userId, bookingId, memberId) first, and service.assignChair's member is one it just found via findActiveMemberByContact(userId, ...) or created via createMember(userId, ...) — both already prove ownership (ADR-0061)
      data,
    });
  }

  // Soft removal (ADR-0072 §5): freezes `status` as-is and stamps `removedAt`, and vacates every
  // chair this member held — the seats they leave behind become vacancies again, not orphans
  // pointing at an excluded member. One transaction so a booking is never left half-degraded.
  async removeMember(memberId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.bookingBandChair.updateMany({ where: { memberId }, data: { memberId: null } });
      await tx.bookingBandMember.update({
        where: { id: memberId }, // scoped-upstream: service.removeBandMember calls findMember(userId, bookingId, memberId) first, already proving ownership (ADR-0061)
        data: { removedAt: new Date() },
      });
    });
  }

  // Applies a lineup template as a fresh booking-owned Lineup (ADR-0072 §3, #884; ADR-0081 §2) —
  // exactly as applying a package produces a Package + PerformanceSet rows: the template's label
  // and slots snapshot onto the new instance, provenance severed. `packageId` null degenerates to
  // a package-less/whole-day Lineup (no segment links) — one code path, no special case.
  // #987: applying targets a *set* of segments, so a four-piece playing the drinks and the
  // reception is one Lineup with four chairs and two links — four vacancies, four searches, four
  // assignments, where the predecessor produced eight of each.
  //
  // The detach-then-sweep shape below is the whole reason journey ④ is safe. The predecessor
  // deleted every Lineup linked to the target segment; generalised naively to a set, applying a
  // solo to {Drinks} would have deleted a four-piece playing {Drinks, Reception} — destroying its
  // reception seats, its people and their confirmations. Detaching only the targeted segments and
  // sweeping only what is left playing nothing keeps AC 3 true by construction rather than as a
  // separate branch, and "swap rather than stack" (#884) still falls out for the same-set case.
  async applyLineupTemplate(
    userId: string,
    bookingId: string,
    lineup: { label: string; slots: Array<{ role: string; order: number }> },
    packageIds: string[],
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.displaceSegments(tx, bookingId, packageIds);

      const created = await tx.lineup.create({ data: { userId, bookingId, label: lineup.label } });
      await tx.lineupPackage.createMany({
        data: packageIds.map((packageId) => ({ userId, lineupId: created.id, packageId })),
      });
      // Chair `order` is per-Lineup (ADR-0081) — a brand-new Lineup always starts at 1.
      await tx.bookingBandChair.createMany({
        data: lineup.slots.map((slot, i) => ({ userId, bookingId, lineupId: created.id, order: i + 1, role: slot.role })),
      });
    });

    return this.prisma.booking.findFirst({ where: { id: bookingId }, select: bookingDetailSelect });
  }

  // Takes a set of segments away from whatever Lineups currently play them, then deletes only those
  // left playing nothing at all — a Lineup fully displaced by the new pick. One that keeps even one
  // segment survives untouched, chairs, people and confirmations included.
  //
  // The empty set is two different facts, and which one it is depends on the booking (ADR-0081 §4;
  // #983's story states 1 and 7 render them differently):
  //   - a booking with no packages: `[]` IS the whole gig, the single bucket every chair sits in,
  //     so re-applying there must swap the band out exactly as targeting a segment does;
  //   - a booking with packages: `[]` means "plays nothing yet" — a parked Lineup. Applying another
  //     parked Lineup displaces nothing, or adding a second band would silently destroy the first.
  private async displaceSegments(
    tx: Prisma.TransactionClient,
    bookingId: string,
    packageIds: string[],
  ): Promise<void> {
    if (!packageIds.length) {
      const packageCount = await tx.package.count({ where: { bookingId } });
      if (packageCount > 0) return; // parked, not the whole gig — displaces nothing
      await tx.lineup.deleteMany({
        where: { bookingId, packages: { none: {} } }, // scoped-upstream: bookingId ownership proven by service.applyLineupTemplate's assertOwnership (ADR-0061)
      });
      return;
    }

    const affected = await tx.lineup.findMany({
      where: { bookingId, packages: { some: { packageId: { in: packageIds } } } },
      select: { id: true, _count: { select: { packages: true } } },
    });
    if (!affected.length) return;

    const affectedIds = affected.map((l) => l.id);
    await tx.lineupPackage.deleteMany({ where: { lineupId: { in: affectedIds }, packageId: { in: packageIds } } });

    // Fully displaced == every segment it played was targeted. Counting the links it held before
    // the delete against how many of them were targeted avoids a second round-trip per Lineup.
    const surrendered = await tx.lineupPackage.groupBy({ by: ['lineupId'], where: { lineupId: { in: affectedIds } }, _count: true });
    const remaining = new Map(surrendered.map((row) => [row.lineupId, row._count]));
    // groupBy omits a lineupId entirely once it holds no links, so an absent row means zero.
    const displaced = affectedIds.filter((id) => (remaining.get(id) ?? 0) === 0);
    if (displaced.length) {
      // Deleting the Lineup cascades its chairs and its remaining links — this is #884's
      // replace-semantics, reached only by a Lineup that now plays nothing.
      await tx.lineup.deleteMany({
        where: { id: { in: displaced } }, // scoped-upstream: ids came from the bookingId-scoped query above; ownership proven by service.applyLineupTemplate's assertOwnership (ADR-0061)
      });
    }
  }

  // #987 journey ④. Sets which segments a Lineup plays, replacing its whole link set. Chairs are
  // never touched: a band losing the drinks set keeps its reception seats, its people, their tokens
  // and their confirmations. Emptying the set leaves the Lineup standing — "plays nothing yet" is a
  // state the musician looks at, not a reason to delete a band they built.
  //
  // Deliberately does NOT take the newly-claimed segments away from other Lineups. Two bands on one
  // segment renders honestly on every surface, and a checkbox must never silently destroy a band
  // the musician cannot see from here. Whether that invariant is wanted at all is #1020;
  // it is not an AC of this issue.
  async setLineupSegments(userId: string, bookingId: string, lineupId: string, packageIds: string[]) {
    await this.prisma.$transaction(async (tx) => {
      await tx.lineupPackage.deleteMany({ where: { lineupId } });
      await tx.lineupPackage.createMany({
        data: packageIds.map((packageId) => ({ userId, lineupId, packageId })),
      });
    });
    return this.prisma.booking.findFirst({ where: { id: bookingId }, select: bookingDetailSelect });
  }

  // "Remove … from this booking" on the Lineups card (#983). Cascades the Lineup's chairs and
  // links; the booking-scoped member rows survive, exactly as they do when a chair is deleted.
  async deleteLineup(bookingId: string, lineupId: string) {
    await this.prisma.lineup.deleteMany({
      where: { id: lineupId }, // scoped-upstream: service.removeLineup calls findLineup(userId, bookingId, lineupId) first, already proving ownership (ADR-0061)
    });
    return this.prisma.booking.findFirst({ where: { id: bookingId }, select: bookingDetailSelect });
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
    return this.prisma.booking.findFirst({ where: { id: bookingId }, select: bookingDetailSelect });
  }

  async updatePackage(bookingId: string, packageId: string, dto: UpdateBookingPackageDto) {
    await this.prisma.package.update({ where: { id: packageId }, data: dto });
    return this.prisma.booking.findFirst({ where: { id: bookingId }, select: bookingDetailSelect });
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

  countNonVoidInvoices(bookingId: string) {
    return this.prisma.invoice.count({
      where: { bookingId, status: { not: 'VOID' } },
    });
  }

  updateSeries(bookingId: string, seriesId: string | null) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { seriesId },
      select: bookingDetailSelect,
    });
  }
}
