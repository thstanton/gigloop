import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsRepository } from './bookings.repository';
import { ContractRepository } from './contract.repository';
import { MusicFormConfigRepository } from './music-form-config.repository';
import { ChecklistRepository, ChecklistItemSeed } from '../checklist/checklist.repository';
import { SeriesRepository } from '../series/series.repository';
import { SeriesService, MemberBookingForSync } from '../series/series.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CopyBookingDto } from './dto/copy-booking.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { UpdateBookingPackageDto } from './dto/update-booking-package.dto';
import { UpsertMusicFormConfigDto } from './dto/upsert-music-form-config.dto';
import { MailService } from '../mail/mail.service';
import { substituteTiptapVariables } from '../mail/tiptap-portal';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { getChecklistDefaults } from './checklist-defaults';
import {
  selectApplicableReminders,
  previewApplicableReminders,
  ReminderItemInput,
  ReminderPreview,
} from '../checklist/checklist-reminders';
import { ReminderConcern } from '../checklist/checklist-concerns';

const VALID_STATUSES = new Set<string>(Object.values(BookingStatus));

const BOOKING_FIELD_SHORTCUT: Readonly<Record<string, string>> = {
  activeContract: 'create_contract',
  depositReceivedAt: 'mark_deposit_received',
};

function resolveContractTemplate(items: Array<{ key: string | null }>): string {
  return items.some((i) => i.key === 'deposit_received')
    ? 'contract_and_deposit_cover'
    : 'contract_cover';
}

export function deriveShortcut(
  rule: Record<string, unknown> | null,
  items: Array<{ key: string | null }>,
): { shortcutType?: string; shortcutTemplateType?: string } {
  if (!rule) return {};
  const type = rule['type'] as string | undefined;
  switch (type) {
    case 'communicationSent': {
      const templateTypes = (rule['templateTypes'] as string[] | undefined) ?? [];
      const isContractEmail =
        templateTypes.includes('contract_cover') || templateTypes.includes('contract_and_deposit_cover');
      return {
        shortcutType: 'send_email',
        shortcutTemplateType: isContractEmail ? resolveContractTemplate(items) : templateTypes[0],
      };
    }
    case 'invoiceExists': {
      const isDeposit = rule['isDeposit'] as boolean | undefined;
      return { shortcutType: isDeposit ? 'create_deposit_invoice' : 'create_balance_invoice' };
    }
    case 'bookingField':
      return { shortcutType: BOOKING_FIELD_SHORTCUT[rule['field'] as string] };
    case 'contractSigned':
      return { shortcutType: 'mark_contract_signed' };
    default:
      return {};
  }
}

@Injectable()
export class BookingsService {
  constructor(
    private repo: BookingsRepository,
    private seriesRepo: SeriesRepository,
    private seriesService: SeriesService,
    private mail: MailService,
    private evaluator: ChecklistEvaluatorService,
    private checklistRepo: ChecklistRepository,
    private contractRepo: ContractRepository,
    private musicFormRepo: MusicFormConfigRepository,
    // Injected solely to open the atomic-create transaction (bounded exception
    // to the repository-pattern rule — see ADR-0047).
    private prisma: PrismaService,
  ) {}

  findAll(userId: string, status?: string | string[], q?: string, eventType?: string, from?: string, to?: string) {
    let statuses: string[];
    if (!status) {
      statuses = [];
    } else if (Array.isArray(status)) {
      statuses = status;
    } else {
      statuses = [status];
    }
    for (const s of statuses) {
      if (!VALID_STATUSES.has(s)) throw new BadRequestException(`Invalid status: ${s}`);
    }
    return this.repo.findAll(userId, statuses as BookingStatus[], q, eventType, from, to);
  }

  async findOne(userId: string, id: string) {
    const booking = await this.repo.findOne(userId, id);
    if (!booking) throw new NotFoundException('Booking not found');
    const { musicFormConfig, musicFormResponse, contracts, ...rest } = booking;
    return {
      ...rest,
      hasMusicFormConfig: !!musicFormConfig,
      hasMusicFormResponse: !!musicFormResponse,
      activeContract: this.normaliseContract(contracts?.[0] ?? null),
    };
  }

  private async resolveSeriesId(userId: string, dto: CreateBookingDto): Promise<string | undefined> {
    if (dto.seriesId && dto.newSeries) {
      throw new BadRequestException('Provide either seriesId or newSeries, not both');
    }
    if (dto.newSeries) {
      const series = await this.seriesRepo.create(userId, dto.newSeries.label, dto.customerId);
      return series.id;
    }
    if (dto.seriesId) {
      const exists = await this.seriesRepo.findExists(userId, dto.seriesId);
      if (!exists) throw new NotFoundException('Series not found');
      return dto.seriesId;
    }
    return undefined;
  }

  private async resolveOrderedPackageTemplates(
    userId: string,
    dto: CreateBookingDto,
  ): Promise<Awaited<ReturnType<BookingsRepository['findPackageTemplates']>>> {
    if (!dto.packageTemplateIds?.length) return [];
    const templates = await this.repo.findPackageTemplates(userId, dto.packageTemplateIds);
    return dto.packageTemplateIds
      .map((id) => templates.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => t != null);
  }

  // The atomic unit (ADR-0047): booking row + checklist seed + series-invoice-line append
  // run inside one transaction, so a throw anywhere rolls back to zero — a retry-on-error
  // yields exactly one booking, closing the duplicate-booking path.
  private async persistBookingAtomically(
    tx: Prisma.TransactionClient,
    userId: string,
    args: {
      dto: CreateBookingDto;
      dtoWithSeries: CreateBookingDto;
      resolvedSeriesId: string | undefined;
      orderedTemplates: Awaited<ReturnType<BookingsRepository['findPackageTemplates']>>;
    },
  ) {
    const { dto, dtoWithSeries, resolvedSeriesId, orderedTemplates } = args;
    const enableMusicForm = dto.enableMusicForm ?? false;

    const created = dto.packageTemplateIds?.length
      ? await this.repo.createWithPackageTemplates(userId, dtoWithSeries, orderedTemplates, enableMusicForm, tx)
      : await this.repo.create(userId, dtoWithSeries, enableMusicForm, tx);

    if (dto.checklistItems.length > 0) {
      await this.checklistRepo.seedChecklistItems(userId, created.id, dto.checklistItems, created.date, created.createdAt, tx);
    }

    if (resolvedSeriesId) {
      const syncPayload: MemberBookingForSync = {
        id: created.id,
        date: created.date,
        fee: created.fee as MemberBookingForSync['fee'],
        sets: (created.sets ?? []) as Array<{ label: string | null; duration: number }>,
      };
      await this.seriesService.syncMemberJoin(userId, resolvedSeriesId, syncPayload, tx);
    }

    return created;
  }

  async create(userId: string, dto: CreateBookingDto) {
    // Reads (and the optional new-series insert) stay outside the transaction — see ADR-0047.
    const resolvedSeriesId = await this.resolveSeriesId(userId, dto);
    if (resolvedSeriesId) {
      await this.seriesService.assertMembershipMutable(userId, resolvedSeriesId);
    }
    const dtoWithSeries = { ...dto, seriesId: resolvedSeriesId };
    const orderedTemplates = await this.resolveOrderedPackageTemplates(userId, dto);

    // Warm the Neon compute (scale-to-zero) *before* opening the transaction so a cold-start
    // wake is absorbed here, not inside the interactive-transaction timeout. The no-template/
    // no-series path has no prior DB read, so this is its only warm-up. maxWait/timeout sit
    // above Prisma's 2s/5s defaults as defence in depth (ADR-0047: cold-start handling).
    await this.prisma.$queryRaw`SELECT 1`;

    const created = await this.prisma.$transaction(
      (tx) =>
        this.persistBookingAtomically(tx, userId, {
          dto,
          dtoWithSeries,
          resolvedSeriesId,
          orderedTemplates,
        }),
      { maxWait: 5000, timeout: 15000 },
    );

    // Auto-complete any structural item whose data already exists at creation — e.g. a
    // booking created with a venue must not seed add_venue as a PENDING nag (PRD #511
    // Story 20: never nag work already done). Post-commit + best-effort, so it never
    // affects the atomic create unit (ADR-0047).
    await this.evaluator.evaluate(created.id).catch(() => {});

    return created;
  }

  // Copy Event (#507 / ADR-0049): clone *this* booking into the same series on a new date.
  // What the gig *is* carries (packages, sets, logistics, music form config); lifecycle
  // state resets (status → CONFIRMED — a copied series gig is already committed — fresh
  // portalToken, no invoices/documents/communications/music form response/deposit). Checklist
  // items copy but their completion resets to pending and due dates recompute against the new
  // date (reusing seedChecklistItems).
  async copyBooking(userId: string, id: string, dto: CopyBookingDto) {
    const source = await this.repo.findOneForClone(userId, id);
    if (!source) throw new NotFoundException('Booking not found');

    // Copying into a series appends a member line to the series invoice, so the same guard
    // create() applies on join applies here — a locked series rejects the copy.
    if (source.seriesId) {
      await this.seriesService.assertMembershipMutable(userId, source.seriesId);
    }

    const newDate = new Date(dto.date);

    // Map source items to seeds: completion + computed due dates are dropped so
    // seedChecklistItems resets state to PENDING/BLOCKED and recomputes due dates against
    // the new booking — a copied COMPLETE item on a brand-new booking would be a bug.
    const checklistSeeds: ChecklistItemSeed[] = source.checklistItems.map((item) => ({
      key: item.key,
      label: item.label,
      completedBy: item.completedBy as ChecklistItemSeed['completedBy'],
      dependsOn: item.dependsOn,
      autoCompleteRule: item.autoCompleteRule as ChecklistItemSeed['autoCompleteRule'],
      requiredForStatus: item.requiredForStatus,
      dueDateRule: item.dueDateRule as ChecklistItemSeed['dueDateRule'],
    }));

    // findOneForClone + assertMembershipMutable already warmed the Neon compute, so the
    // transaction opens against a live connection (cf. create()'s explicit SELECT 1).
    const copied = await this.prisma.$transaction(
      async (tx) => {
        const created = await this.repo.cloneBookingCore(userId, source, newDate, tx);

        if (checklistSeeds.length > 0) {
          await this.checklistRepo.seedChecklistItems(userId, created.id, checklistSeeds, created.date, created.createdAt, tx);
        }

        if (source.seriesId) {
          const syncPayload: MemberBookingForSync = {
            id: created.id,
            date: created.date,
            fee: created.fee as MemberBookingForSync['fee'],
            sets: (created.sets ?? []) as Array<{ label: string | null; duration: number }>,
          };
          await this.seriesService.syncMemberJoin(userId, source.seriesId, syncPayload, tx);
        }

        return created;
      },
      { maxWait: 5000, timeout: 15000 },
    );

    // A copied booking carries its source's venue, so add_venue must start COMPLETE rather
    // than re-nag work already done (PRD #511 Story 20). Post-commit + best-effort.
    await this.evaluator.evaluate(copied.id).catch(() => {});

    return copied;
  }

  async update(userId: string, id: string, dto: UpdateBookingDto) {
    await this.findOne(userId, id);
    const updated = await this.repo.update(id, dto);
    if (dto.date !== undefined) {
      await this.checklistRepo.recomputeChecklistDueDates(id, updated.date, updated.createdAt);
    }
    // Re-evaluate auto-complete rules when a field a rule binds to changes. venueId drives
    // the add_venue structural item (PRD #511 Module A/D): setting it must auto-complete the
    // item without the musician ticking it.
    if (dto.status !== undefined || dto.venueId !== undefined) {
      await this.evaluator.evaluate(id).catch(() => {});
    }
    return updated;
  }

  async delete(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.repo.cancel(id);
  }

  async addSet(userId: string, bookingId: string, dto: CreateSetDto) {
    await this.findOne(userId, bookingId);
    const result = await this.repo.addSet(userId, bookingId, dto);
    // Re-evaluate: the first set satisfies build_itinerary (PRD #511 Story 21). Post-add + best-effort.
    await this.evaluator.evaluate(bookingId).catch(() => {});
    return result;
  }

  async updateSet(userId: string, bookingId: string, setId: string, dto: UpdateSetDto) {
    await this.findOne(userId, bookingId);
    const set = await this.repo.findSet(userId, bookingId, setId);
    if (!set) throw new NotFoundException('Set not found');
    // Re-parenting: a non-null target package must belong to this booking (null = ungroup).
    if (dto.packageId != null) {
      const pkg = await this.repo.findBookingPackage(userId, bookingId, dto.packageId);
      if (!pkg) throw new NotFoundException('Package not found');
    }
    return this.repo.updateSet(setId, dto);
  }

  async deleteSet(userId: string, bookingId: string, setId: string) {
    await this.findOne(userId, bookingId);
    const set = await this.repo.findSet(userId, bookingId, setId);
    if (!set) throw new NotFoundException('Set not found');
    return this.repo.deleteSet(setId);
  }

  async getMusicFormConfig(userId: string, bookingId: string) {
    await this.findOne(userId, bookingId);
    const config = await this.musicFormRepo.findMusicFormConfig(bookingId);
    if (!config) throw new NotFoundException('Music form config not found');
    return config;
  }

  async upsertMusicFormConfig(userId: string, bookingId: string, dto: UpsertMusicFormConfigDto) {
    await this.findOne(userId, bookingId);
    return this.musicFormRepo.upsertMusicFormConfig(userId, bookingId, dto);
  }

  async deleteMusicFormConfig(userId: string, bookingId: string) {
    await this.findOne(userId, bookingId);
    return this.musicFormRepo.deleteMusicFormConfig(bookingId);
  }

  async applyPackageTemplate(userId: string, bookingId: string, packageTemplateId: string) {
    await this.findOne(userId, bookingId);
    const templates = await this.repo.findPackageTemplates(userId, [packageTemplateId]);
    if (!templates.length) throw new NotFoundException('Package template not found');
    const template = templates[0];
    const booking = await this.repo.applyPackageTemplate(userId, bookingId, template);
    const mapped = this.mapBooking(booking!);

    // Apply-later music-form suggestion (ADR-0046). Provenance is severed, so apply
    // time is the only moment the template's key moments/genres are knowable for this
    // booking. When the form is on we *offer* them — never silently write (the repo
    // does not touch the config; the frontend lets the musician accept or dismiss).
    const suggestion =
      mapped.hasMusicFormConfig &&
      (template.keyMoments.length > 0 || template.defaultGenreSelection.length > 0)
        ? {
            keyMoments: template.keyMoments.map((label) => ({ label, section: template.label })),
            genres: template.defaultGenreSelection,
          }
        : null;

    // Re-evaluate: applying a template seeds sets, satisfying build_itinerary
    // (PRD #511 Story 21: never nag work already done). Post-apply + best-effort.
    await this.evaluator.evaluate(bookingId).catch(() => {});

    return { booking: mapped, suggestion };
  }

  async updatePackage(userId: string, bookingId: string, packageId: string, dto: UpdateBookingPackageDto) {
    await this.findOne(userId, bookingId);
    const pkg = await this.repo.findBookingPackage(userId, bookingId, packageId);
    if (!pkg) throw new NotFoundException('Applied package not found');
    const booking = await this.repo.updatePackage(bookingId, packageId, dto);
    return this.mapBooking(booking!);
  }

  async removePackage(userId: string, bookingId: string, packageId: string) {
    await this.findOne(userId, bookingId);
    const pkg = await this.repo.findBookingPackage(userId, bookingId, packageId);
    if (!pkg) throw new NotFoundException('Applied package not found');
    const booking = await this.repo.removePackage(bookingId, packageId, pkg.label);
    return this.mapBooking(booking!);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapBooking(booking: any) {
    const { musicFormConfig, musicFormResponse, contracts, ...rest } = booking;
    return {
      ...rest,
      hasMusicFormConfig: !!musicFormConfig,
      hasMusicFormResponse: !!musicFormResponse,
      activeContract: this.normaliseContract(contracts?.[0] ?? null),
    };
  }

  private normaliseContract(raw: { id: string; createdAt: Date; updatedAt: Date; status: string; content: unknown; signedAt: Date | null } | null) {
    if (!raw) return null;
    return {
      id: raw.id,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString(),
      status: raw.status,
      content: raw.content,
      signedAt: raw.signedAt?.toISOString() ?? null,
    };
  }

  async getMusicFormResponse(userId: string, bookingId: string) {
    await this.findOne(userId, bookingId);
    const response = await this.musicFormRepo.findMusicFormResponse(userId, bookingId);
    if (!response) throw new NotFoundException('Music form response not found');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requests = (response.specialRequests as any[]) ?? [];
    const allSongIds = [
      ...response.selectedSongIds,
      ...requests.map((r: { songId?: string }) => r.songId).filter((id): id is string => !!id),
    ];
    const songs = await this.musicFormRepo.findSongsByIds(userId, allSongIds);
    const songMap = new Map(songs.map((s) => [s.id, s]));

    return {
      selectedSongs: response.selectedSongIds
        .map((id) => songMap.get(id))
        .filter((s): s is NonNullable<typeof s> => s !== undefined),
      specialRequests: requests.map((r: { key: string; songId?: string; freeText?: string }) => ({
        key: r.key,
        song: r.songId ? (songMap.get(r.songId) ?? null) : null,
        freeText: r.freeText ?? null,
      })),
      notes: response.notes,
      submittedAt: response.submittedAt.toISOString(),
    };
  }

  async createContract(userId: string, bookingId: string) {
    await this.findOne(userId, bookingId);

    const template = await this.contractRepo.findContractTemplate(userId);
    if (!template) throw new NotFoundException('Contract template not found');

    const context = await this.mail.buildContext(userId, bookingId);
    const substituted = substituteTiptapVariables(template.content, context);

    // Void any existing active contract before creating the new one
    const existing = await this.contractRepo.findActiveContract(bookingId);
    if (existing) await this.contractRepo.voidContract(existing.id);

    const contract = await this.contractRepo.createContractRecord(userId, bookingId, substituted);
    await this.evaluator.evaluate(bookingId).catch(() => {});
    return {
      id: contract.id,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
      status: contract.status,
      content: contract.content,
      signedAt: null,
    };
  }

  async updateContract(userId: string, bookingId: string, contractId: string, dto: UpdateContractDto) {
    await this.findOne(userId, bookingId);
    const contract = await this.contractRepo.findContractById(userId, bookingId, contractId);
    if (!contract) throw new NotFoundException('Contract not found');
    const updated = await this.contractRepo.updateContract(contractId, dto);
    return {
      id: updated.id,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      status: updated.status,
      content: updated.content,
      signedAt: updated.signedAt?.toISOString() ?? null,
    };
  }

  async sendContract(userId: string, bookingId: string, contractId: string) {
    await this.findOne(userId, bookingId);
    const contract = await this.contractRepo.findContractById(userId, bookingId, contractId);
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'DRAFT') throw new BadRequestException('Only DRAFT contracts can be sent');
    const updated = await this.contractRepo.markContractSent(contractId);
    await this.evaluator.evaluate(bookingId).catch(() => {});
    return {
      id: updated.id,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      status: updated.status,
      content: updated.content,
      signedAt: null,
    };
  }

  async deleteContract(userId: string, bookingId: string, contractId: string) {
    await this.findOne(userId, bookingId);
    const contract = await this.contractRepo.findContractById(userId, bookingId, contractId);
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'DRAFT') throw new BadRequestException('Only DRAFT contracts can be deleted');
    await this.contractRepo.deleteContract(contractId);
  }

  async voidContract(userId: string, bookingId: string, contractId: string, confirmSignedVoid?: boolean) {
    await this.findOne(userId, bookingId);
    const contract = await this.contractRepo.findContractById(userId, bookingId, contractId);
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status === 'VOID') throw new BadRequestException('Contract is already VOID');
    if (contract.status === 'SIGNED' && !confirmSignedVoid) {
      throw new BadRequestException('Voiding a signed contract requires confirmSignedVoid: true');
    }
    await this.contractRepo.voidContract(contractId);
    await this.evaluator.evaluate(bookingId).catch(() => {});
  }

  async getChecklist(userId: string, bookingId: string) {
    await this.findOne(userId, bookingId);
    const items = await this.repo.findChecklistItems(userId, bookingId);
    return items.map(({ steps, ...item }) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      completedAt: item.completedAt?.toISOString() ?? null,
      dueDate: item.dueDate?.toISOString() ?? null,
      ...deriveShortcut(item.autoCompleteRule as Record<string, unknown> | null, items),
      // Multi-step goal steps (ADR-0057). The client derives the active step + fold;
      // #611 routes the active step's action via its autoCompleteRule.
      steps: (steps ?? []).map((step) => ({
        id: step.id,
        key: step.key,
        label: step.label,
        order: step.order,
        kind: step.kind,
        completeMode: step.completeMode,
        state: step.state,
        completedBy: step.completedBy,
        completedAt: step.completedAt?.toISOString() ?? null,
        autoCompleteRule: step.autoCompleteRule as Record<string, unknown> | null,
      })),
    }));
  }

  async updateChecklistItem(
    userId: string,
    bookingId: string,
    itemId: string,
    state: 'COMPLETE' | 'PENDING' | 'SKIPPED',
  ) {
    await this.findOne(userId, bookingId);
    const item = await this.repo.findChecklistItemById(userId, bookingId, itemId);
    const result = await this.checklistRepo.updateChecklistItemState(userId, bookingId, itemId, state);
    if (result.count === 0) throw new NotFoundException('Checklist item not found');
    if (item?.key === 'deposit_received') {
      // COMPLETE records the real deposit fact; PENDING (a genuine un-tick) clears it.
      // SKIPPED is an opt-out of the *reminder* — it must not wipe a real deposit date.
      if (state === 'COMPLETE') {
        await this.repo.setDepositReceivedAt(bookingId, new Date()).catch(() => {});
      } else if (state === 'PENDING') {
        await this.repo.clearDepositReceivedAt(bookingId).catch(() => {});
      }
    }
    await this.evaluator.evaluate(bookingId).catch(() => {});
    // Return the recomputed checklist (post-evaluate) so the client settles the
    // toggle and its dependency cascade in one round-trip — no follow-up refetch.
    return this.getChecklist(userId, bookingId);
  }

  async addChecklistItem(
    userId: string,
    bookingId: string,
    label: string,
    requiredForStatus: string | null,
    dueDate: string | null,
    concern: string | null = null,
  ) {
    await this.findOne(userId, bookingId);
    const maxOrder = await this.repo.getMaxChecklistOrder(bookingId);
    const item = await this.repo.createChecklistItem(
      userId,
      bookingId,
      label,
      requiredForStatus ?? null,
      dueDate ? new Date(dueDate) : null,
      maxOrder + 1,
      concern,
    );
    return {
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      completedAt: null,
      dueDate: item.dueDate?.toISOString() ?? null,
    };
  }

  // Turn a system reminder on for a booking (ADR-0052): un-skip an existing record,
  // or on-demand seed one if none exists. Idempotent if it is already on.
  async enableReminder(userId: string, bookingId: string, key: string) {
    const booking = await this.findOne(userId, bookingId);
    const existing = await this.checklistRepo.findItemByKey(bookingId, key);
    if (existing) {
      if (existing.state === 'SKIPPED') {
        await this.checklistRepo.updateChecklistItemState(userId, bookingId, existing.id, 'PENDING');
      }
    } else {
      await this.checklistRepo.seedReminderItem(
        userId,
        bookingId,
        key,
        booking.date,
        booking.createdAt,
      );
    }
    // Settle dependency/auto-complete state for the (possibly new) item and downstream.
    await this.evaluator.evaluate(bookingId).catch(() => {});
    return { success: true };
  }

  // The ordered "Remind me about" list for one concern on one booking (selector,
  // Module 2). Global master-switch disables come from the user's checklist template.
  async getApplicableReminders(userId: string, bookingId: string, concern: ReminderConcern) {
    const booking = await this.findOne(userId, bookingId);
    const [items, profile] = await Promise.all([
      this.repo.findChecklistItemsForReminders(userId, bookingId),
      this.repo.findUserProfile(userId),
    ]);
    const defaults = getChecklistDefaults(profile?.preferences as Record<string, unknown> | null);
    const disabledKeys = new Set(
      defaults.filter((d) => d.enabled === false && d.key).map((d) => d.key as string),
    );
    return selectApplicableReminders(concern, {
      items: items as ReminderItemInput[],
      status: booking.status,
      disabledKeys,
    });
  }

  // Pre-creation preview for the New Booking form (#560): the system reminders a booking started at
  // `status` would offer, grouped by concern. No booking exists yet, so this runs over the user's
  // template defaults (for the disabled-key master switch) rather than a real checklist.
  async previewReminders(userId: string, status: string): Promise<ReminderPreview[]> {
    const profile = await this.repo.findUserProfile(userId);
    const defaults = getChecklistDefaults(profile?.preferences as Record<string, unknown> | null);
    const disabledKeys = new Set(
      defaults.filter((d) => d.enabled === false && d.key).map((d) => d.key as string),
    );
    return previewApplicableReminders({ status, disabledKeys });
  }

  private async checkSeriesJoin(
    userId: string,
    bookingId: string,
    seriesId: string,
    booking: { customerId: string; customer: { name: string } },
    confirm?: boolean,
  ): Promise<{ requiresConfirmation: true; warning: string } | null> {
    const series = await this.seriesRepo.findOneLight(userId, seriesId);
    if (!series) throw new NotFoundException('Series not found');

    const nonVoidCount = await this.repo.countNonVoidInvoices(bookingId);
    if (nonVoidCount > 0) {
      throw new ConflictException(
        'This booking has non-VOID invoices. Void or delete them before adding the booking to a series.',
      );
    }

    await this.seriesService.assertMembershipMutable(userId, seriesId);

    if (booking.customerId !== series.customerId && !confirm) {
      return {
        requiresConfirmation: true,
        warning: `This booking's customer (${booking.customer.name}) differs from the series billing customer (${series.customer.name}). The series invoice will be addressed to ${series.customer.name}. Resend with confirm: true to proceed.`,
      };
    }
    return null;
  }

  async updateSeries(userId: string, bookingId: string, seriesId: string | null, confirm?: boolean, newSeriesLabel?: string) {
    const booking = await this.findOne(userId, bookingId);
    const previousSeriesId = (booking as { seriesId?: string | null }).seriesId ?? null;

    if (newSeriesLabel) {
      const created = await this.seriesRepo.create(userId, newSeriesLabel, booking.customerId);
      seriesId = created.id;
    }

    if (seriesId !== null) {
      const earlyReturn = await this.checkSeriesJoin(userId, bookingId, seriesId, booking, confirm);
      if (earlyReturn) return earlyReturn;
    } else if (previousSeriesId) {
      await this.seriesService.assertMembershipMutable(userId, previousSeriesId);
    }

    const result = await this.repo.updateSeries(bookingId, seriesId);

    if (seriesId !== null) {
      const syncPayload: MemberBookingForSync = {
        id: booking.id,
        date: booking.date as unknown as Date,
        fee: booking.fee as MemberBookingForSync['fee'],
        sets: (booking.sets ?? []) as Array<{ label: string | null; duration: number }>,
      };
      await this.seriesService.syncMemberJoin(userId, seriesId, syncPayload);
    } else if (previousSeriesId) {
      await this.seriesService.syncMemberLeave(userId, previousSeriesId, bookingId);
    }

    return result;
  }

  async getActions(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const profile = await this.repo.findUserProfile(userId);
    const prefs = profile?.preferences as { reminderLeadDays?: number } | null;
    const reminderLeadDays = prefs?.reminderLeadDays ?? 7;

    const actions = await this.checklistRepo.findActionItems(userId, today, reminderLeadDays);

    return actions.map(({ booking, item }) => ({
      bookingId: booking.id,
      bookingDate: booking.date.toISOString(),
      bookingTitle: booking.title,
      customerName: booking.customer.name,
      venueName: booking.venue?.name ?? null,
      item: {
        key: item.key ?? '',
        label: item.label,
        state: (item.state === 'FAILED' ? 'failed' : 'outstanding') as 'failed' | 'outstanding',
      },
    }));
  }
}
