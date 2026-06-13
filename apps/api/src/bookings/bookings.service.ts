import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { ContractRepository } from './contract.repository';
import { MusicFormConfigRepository } from './music-form-config.repository';
import { ChecklistRepository } from '../checklist/checklist.repository';
import { SeriesRepository } from '../series/series.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { UpsertMusicFormConfigDto } from './dto/upsert-music-form-config.dto';
import { MailService } from '../mail/mail.service';
import { substituteTiptapVariables } from '../mail/tiptap-portal';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';

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

function deriveShortcut(
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
    private mail: MailService,
    private evaluator: ChecklistEvaluatorService,
    private checklistRepo: ChecklistRepository,
    private contractRepo: ContractRepository,
    private musicFormRepo: MusicFormConfigRepository,
  ) {}

  findAll(userId: string, status?: string) {
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }
    return this.repo.findAll(userId, status as BookingStatus | undefined);
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

  async create(userId: string, dto: CreateBookingDto) {
    const resolvedSeriesId = await this.resolveSeriesId(userId, dto);
    const dtoWithSeries = { ...dto, seriesId: resolvedSeriesId };
    let booking;
    if (!dto.formatIds?.length) {
      booking = await this.repo.create(userId, dtoWithSeries);
    } else {
      const [formats, profile] = await Promise.all([
        this.repo.findFormats(userId, dto.formatIds),
        this.repo.findUserProfile(userId),
      ]);
      const orderedFormats = dto.formatIds
        .map((id) => formats.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => f != null);
      const songRequestFormEnabled = profile?.songRequestFormEnabled ?? false;
      booking = await this.repo.createWithFormats(userId, dtoWithSeries, orderedFormats, songRequestFormEnabled);
    }

    if (dto.checklistItems.length > 0) {
      await this.checklistRepo.seedChecklistItems(userId, booking.id, dto.checklistItems, booking.date, booking.createdAt);
    }
    return booking;
  }

  async update(userId: string, id: string, dto: UpdateBookingDto) {
    await this.findOne(userId, id);
    const updated = await this.repo.update(id, dto);
    if (dto.date !== undefined) {
      await this.checklistRepo.recomputeChecklistDueDates(id, updated.date, updated.createdAt);
    }
    if (dto.status !== undefined) {
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
    return this.repo.addSet(userId, bookingId, dto);
  }

  async updateSet(userId: string, bookingId: string, setId: string, dto: UpdateSetDto) {
    await this.findOne(userId, bookingId);
    const set = await this.repo.findSet(userId, bookingId, setId);
    if (!set) throw new NotFoundException('Set not found');
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

  async applyFormat(userId: string, bookingId: string, formatId: string) {
    await this.findOne(userId, bookingId);
    const formats = await this.repo.findFormats(userId, [formatId]);
    if (!formats.length) throw new NotFoundException('Format not found');
    const booking = await this.repo.applyFormat(userId, bookingId, formats[0]);
    return this.mapBooking(booking!);
  }

  async removeFormat(userId: string, bookingId: string, bookingFormatId: string) {
    await this.findOne(userId, bookingId);
    const bookingFormat = await this.repo.findBookingFormat(userId, bookingId, bookingFormatId);
    if (!bookingFormat) throw new NotFoundException('Applied format not found');
    const booking = await this.repo.removeFormat(bookingId, bookingFormatId, bookingFormat.packageId);
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
    return items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      completedAt: item.completedAt?.toISOString() ?? null,
      dueDate: item.dueDate?.toISOString() ?? null,
      ...deriveShortcut(item.autoCompleteRule as Record<string, unknown> | null, items),
    }));
  }

  async updateChecklistItem(userId: string, bookingId: string, itemId: string, state: 'COMPLETE' | 'PENDING') {
    await this.findOne(userId, bookingId);
    const item = await this.repo.findChecklistItemById(userId, bookingId, itemId);
    const result = await this.checklistRepo.updateChecklistItemState(userId, bookingId, itemId, state);
    if (result.count === 0) throw new NotFoundException('Checklist item not found');
    if (item?.key === 'deposit_received') {
      if (state === 'COMPLETE') {
        await this.repo.setDepositReceivedAt(bookingId, new Date()).catch(() => {});
      } else {
        await this.repo.clearDepositReceivedAt(bookingId).catch(() => {});
      }
    }
    await this.evaluator.evaluate(bookingId).catch(() => {});
    return { success: true };
  }

  async addChecklistItem(
    userId: string,
    bookingId: string,
    label: string,
    requiredForStatus: string | null,
    dueDate: string | null,
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
    );
    return {
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      completedAt: null,
      dueDate: item.dueDate?.toISOString() ?? null,
    };
  }

  async updateSeries(userId: string, bookingId: string, seriesId: string | null, confirm?: boolean) {
    const booking = await this.findOne(userId, bookingId);

    if (seriesId !== null) {
      const series = await this.seriesRepo.findOneLight(userId, seriesId);
      if (!series) throw new NotFoundException('Series not found');

      const nonVoidCount = await this.repo.countNonVoidInvoices(bookingId);
      if (nonVoidCount > 0) {
        throw new ConflictException(
          'This booking has non-VOID invoices. Void or delete them before adding the booking to a series.',
        );
      }

      if (booking.customerId !== series.customerId && !confirm) {
        return {
          requiresConfirmation: true,
          warning: `This booking's customer (${booking.customer.name}) differs from the series billing customer (${series.customer.name}). The series invoice will be addressed to ${series.customer.name}. Resend with confirm: true to proceed.`,
        };
      }
    }

    return this.repo.updateSeries(bookingId, seriesId);
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
