import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
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

// ─── Actions computation ──────────────────────────────────────────────────────


function inWindow(bookingDate: Date, today: Date, days: number | null, post: boolean): boolean {
  if (days === null) return false;
  const diff = Math.floor((bookingDate.getTime() - today.getTime()) / 86_400_000);
  return post ? diff >= -days && diff < 0 : diff >= 0 && diff <= days;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeActionItem(booking: any, profile: any, today: Date) {
  const bookingDate = new Date(booking.date);
  bookingDate.setHours(0, 0, 0, 0);

  const trackDeposit = true;
  const bookingDatePassed = bookingDate < today;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comms: Array<{ status: string; template: { builtInType: string | null } | null }> = booking.communications;
  const invoices: Array<{ isDeposit: boolean; status: string }> = booking.invoices;
  const activeContract: { status: string; signedAt: Date | null } | null = booking.contracts?.[0] ?? null;

  const hasSent = (...types: string[]) =>
    comms.some((c) => types.includes(c.template?.builtInType ?? '') && c.status === 'SENT');
  const lastFailed = (...types: string[]) => {
    const rel = comms.filter((c) => types.includes(c.template?.builtInType ?? ''));
    return rel.length > 0 && rel[rel.length - 1].status === 'FAILED';
  };

  const gtEq = (s: string, target: string) =>
    ['CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'].slice(
      ['CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'].indexOf(target),
    ).includes(s);

  const contractSigned = activeContract?.status === 'SIGNED';

  const candidates = [
    { key: 'send_quote', label: 'Send quote', done: hasSent('quote'), failed: lastFailed('quote'), irrelevant: gtEq(booking.status, 'CONFIRMED') },
    { key: 'create_deposit_invoice', label: 'Create deposit invoice', done: invoices.some((i) => i.isDeposit), failed: false, irrelevant: !trackDeposit },
    { key: 'send_contract', label: 'Send contract & deposit email', done: hasSent('contract_cover', 'contract_and_deposit_cover'), failed: lastFailed('contract_cover', 'contract_and_deposit_cover'), irrelevant: contractSigned && (!!booking.depositReceivedAt || !trackDeposit) },
    { key: 'create_balance_invoice', label: 'Create balance invoice', done: invoices.some((i) => !i.isDeposit), failed: false, irrelevant: booking.status === 'ENQUIRY' },
    { key: 'music_form_invite', label: 'Send music form invite', done: hasSent('music_form_invite'), failed: lastFailed('music_form_invite'), irrelevant: !booking.musicFormConfig || booking.status === 'ENQUIRY' },
    { key: 'send_thank_you', label: 'Send thank you', done: hasSent('thank_you'), failed: lastFailed('thank_you'), irrelevant: !bookingDatePassed },
  ];

  const prefs = profile?.preferences as { reminderLeadDays?: number } | null;
  const reminderLeadDays = prefs?.reminderLeadDays ?? 7;

  for (const c of candidates) {
    if (c.irrelevant || c.done) continue;
    if (!inWindow(bookingDate, today, reminderLeadDays, c.key === 'send_thank_you')) continue;
    return { key: c.key, label: c.label, state: (c.failed ? 'failed' : 'outstanding') as 'failed' | 'outstanding' };
  }

  return null;
}

@Injectable()
export class BookingsService {
  constructor(
    private repo: BookingsRepository,
    private mail: MailService,
    private evaluator: ChecklistEvaluatorService,
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
    const raw = contracts?.[0] ?? null;
    const activeContract = raw
      ? {
          id: raw.id,
          createdAt: raw.createdAt.toISOString(),
          updatedAt: raw.updatedAt.toISOString(),
          status: raw.status,
          content: raw.content,
          signedAt: raw.signedAt?.toISOString() ?? null,
        }
      : null;
    return {
      ...rest,
      hasMusicFormConfig: !!musicFormConfig,
      hasMusicFormResponse: !!musicFormResponse,
      activeContract,
    };
  }

  async create(userId: string, dto: CreateBookingDto) {
    let booking;
    if (!dto.formatIds?.length) {
      booking = await this.repo.create(userId, dto);
    } else {
      const [formats, profile] = await Promise.all([
        this.repo.findFormats(userId, dto.formatIds),
        this.repo.findUserProfile(userId),
      ]);
      const orderedFormats = dto.formatIds
        .map((id) => formats.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => f !== null && f !== undefined);
      const songRequestFormEnabled = profile?.songRequestFormEnabled ?? false;
      booking = await this.repo.createWithFormats(userId, dto, orderedFormats, songRequestFormEnabled);
    }

    if (dto.checklistItems.length > 0) {
      await this.repo.seedChecklistItems(userId, booking.id, dto.checklistItems, booking.date, booking.createdAt);
    }
    return booking;
  }

  async update(userId: string, id: string, dto: UpdateBookingDto) {
    await this.findOne(userId, id);
    const updated = await this.repo.update(id, dto);
    if (dto.date !== undefined) {
      await this.repo.recomputeChecklistDueDates(id, updated.date, updated.createdAt);
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
    const config = await this.repo.findMusicFormConfig(bookingId);
    if (!config) throw new NotFoundException('Music form config not found');
    return config;
  }

  async upsertMusicFormConfig(userId: string, bookingId: string, dto: UpsertMusicFormConfigDto) {
    await this.findOne(userId, bookingId);
    return this.repo.upsertMusicFormConfig(userId, bookingId, dto);
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
    const raw = contracts?.[0] ?? null;
    const activeContract = raw
      ? {
          id: raw.id,
          createdAt: raw.createdAt.toISOString(),
          updatedAt: raw.updatedAt.toISOString(),
          status: raw.status,
          content: raw.content,
          signedAt: raw.signedAt?.toISOString() ?? null,
        }
      : null;
    return { ...rest, hasMusicFormConfig: !!musicFormConfig, hasMusicFormResponse: !!musicFormResponse, activeContract };
  }

  async getMusicFormResponse(userId: string, bookingId: string) {
    await this.findOne(userId, bookingId);
    const response = await this.repo.findMusicFormResponse(userId, bookingId);
    if (!response) throw new NotFoundException('Music form response not found');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requests = (response.specialRequests as any[]) ?? [];
    const allSongIds = [
      ...response.selectedSongIds,
      ...requests.map((r: { songId?: string }) => r.songId).filter((id): id is string => !!id),
    ];
    const songs = await this.repo.findSongsByIds(userId, allSongIds);
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

    const template = await this.repo.findContractTemplate(userId);
    if (!template) throw new NotFoundException('Contract template not found');

    const context = await this.mail.buildContext(userId, bookingId);
    const substituted = substituteTiptapVariables(template.content, context);

    // Void any existing active contract before creating the new one
    const existing = await this.repo.findActiveContract(bookingId);
    if (existing) await this.repo.voidContract(existing.id);

    const contract = await this.repo.createContractRecord(userId, bookingId, substituted);
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
    const contract = await this.repo.findContractById(userId, bookingId, contractId);
    if (!contract) throw new NotFoundException('Contract not found');
    const updated = await this.repo.updateContract(contractId, dto);
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
    const contract = await this.repo.findContractById(userId, bookingId, contractId);
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'DRAFT') throw new BadRequestException('Only DRAFT contracts can be sent');
    const updated = await this.repo.markContractSent(contractId);
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
    const contract = await this.repo.findContractById(userId, bookingId, contractId);
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== 'DRAFT') throw new BadRequestException('Only DRAFT contracts can be deleted');
    await this.repo.deleteContract(contractId);
  }

  async voidContract(userId: string, bookingId: string, contractId: string, confirmSignedVoid?: boolean) {
    await this.findOne(userId, bookingId);
    const contract = await this.repo.findContractById(userId, bookingId, contractId);
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status === 'VOID') throw new BadRequestException('Contract is already VOID');
    if (contract.status === 'SIGNED' && !confirmSignedVoid) {
      throw new BadRequestException('Voiding a signed contract requires confirmSignedVoid: true');
    }
    await this.repo.voidContract(contractId);
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
    }));
  }

  async updateChecklistItem(userId: string, bookingId: string, itemId: string, state: 'COMPLETE' | 'PENDING') {
    await this.findOne(userId, bookingId);
    const item = await this.repo.findChecklistItemById(userId, bookingId, itemId);
    const result = await this.repo.updateChecklistItemState(userId, bookingId, itemId, state);
    if (result.count === 0) throw new NotFoundException('Checklist item not found');
    if (state === 'COMPLETE' && item?.key === 'deposit_received') {
      await this.repo.setDepositReceivedAt(bookingId, new Date()).catch(() => {});
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

  async getActions(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(today);
    from.setDate(from.getDate() - 30); // 30-day past window for thank-you items
    const to = new Date(today);
    to.setDate(to.getDate() + 90);

    const [bookings, profile] = await Promise.all([
      this.repo.findBookingsForActions(userId, from, to),
      this.repo.findUserProfile(userId),
    ]);

    return bookings
      .map((b) => {
        const item = computeActionItem(b, profile, today);
        if (!item) return null;
        return {
          bookingId: b.id,
          bookingDate: b.date.toISOString(),
          bookingTitle: b.title,
          customerName: b.customer.name,
          venueName: b.venue?.name ?? null,
          item,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
  }
}
