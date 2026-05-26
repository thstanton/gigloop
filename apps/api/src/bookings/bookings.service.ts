import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsRepository } from './bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { UpsertMusicFormConfigDto } from './dto/upsert-music-form-config.dto';

const VALID_STATUSES = new Set<string>(Object.values(BookingStatus));

// ─── Actions computation ──────────────────────────────────────────────────────

const REMINDER_FIELD: Record<string, string> = {
  send_quote: 'quoteReminderDays',
  create_deposit_invoice: 'depositInvoiceReminderDays',
  send_contract: 'contractReminderDays',
  create_balance_invoice: 'balanceInvoiceReminderDays',
  music_form_invite: 'musicFormReminderDays',
  send_thank_you: 'thankYouReminderDays',
};

function inWindow(bookingDate: Date, today: Date, days: number | null, post: boolean): boolean {
  if (days === null) return false;
  const diff = Math.floor((bookingDate.getTime() - today.getTime()) / 86_400_000);
  return post ? diff >= -days && diff < 0 : diff >= 0 && diff <= days;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeActionItem(booking: any, profile: any, today: Date) {
  const bookingDate = new Date(booking.date);
  bookingDate.setHours(0, 0, 0, 0);

  const resolvedMode = booking.depositTrackingMode ?? profile?.depositTrackingMode ?? 'INVOICE';
  const trackDeposit = resolvedMode !== 'NONE';
  const bookingDatePassed = bookingDate < today;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comms: Array<{ status: string; template: { builtInType: string | null } | null }> = booking.communications;
  const invoices: Array<{ isDeposit: boolean; status: string }> = booking.invoices;

  const hasSent = (...types: string[]) =>
    comms.some((c) => types.includes(c.template?.builtInType ?? '') && c.status === 'SENT');
  const lastFailed = (...types: string[]) => {
    const rel = comms.filter((c) => types.includes(c.template?.builtInType ?? ''));
    return rel.length > 0 && rel[rel.length - 1].status === 'FAILED';
  };

  const gtEq = (s: string, target: string) =>
    ['CONFIRMED', 'INVOICED', 'SETTLED', 'COMPLETED', 'CANCELLED'].slice(
      ['CONFIRMED', 'INVOICED', 'SETTLED', 'COMPLETED', 'CANCELLED'].indexOf(target),
    ).includes(s);

  const candidates = [
    { key: 'send_quote', label: 'Send quote', done: hasSent('quote'), failed: lastFailed('quote'), irrelevant: gtEq(booking.status, 'CONFIRMED') },
    { key: 'create_deposit_invoice', label: 'Create deposit invoice', done: invoices.some((i) => i.isDeposit), failed: false, irrelevant: !trackDeposit },
    { key: 'send_contract', label: 'Send contract & deposit email', done: hasSent('contract_cover', 'contract_and_deposit_cover'), failed: lastFailed('contract_cover', 'contract_and_deposit_cover'), irrelevant: !!booking.contractSignedAt && (!!booking.depositReceivedAt || !trackDeposit) },
    { key: 'create_balance_invoice', label: 'Create balance invoice', done: invoices.some((i) => !i.isDeposit), failed: false, irrelevant: booking.status === 'ENQUIRY' },
    { key: 'music_form_invite', label: 'Send music form invite', done: hasSent('music_form_invite'), failed: lastFailed('music_form_invite'), irrelevant: !booking.musicFormConfig || booking.status === 'ENQUIRY' },
    { key: 'send_thank_you', label: 'Send thank you', done: hasSent('thank_you'), failed: lastFailed('thank_you'), irrelevant: !bookingDatePassed },
  ];

  for (const c of candidates) {
    if (c.irrelevant || c.done) continue;
    const days = (profile?.[REMINDER_FIELD[c.key]] as number | null) ?? null;
    if (!inWindow(bookingDate, today, days, c.key === 'send_thank_you')) continue;
    return { key: c.key, label: c.label, state: (c.failed ? 'failed' : 'outstanding') as 'failed' | 'outstanding' };
  }

  return null;
}

@Injectable()
export class BookingsService {
  constructor(private repo: BookingsRepository) {}

  findAll(userId: string, status?: string) {
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }
    return this.repo.findAll(userId, status as BookingStatus | undefined);
  }

  async findOne(userId: string, id: string) {
    const booking = await this.repo.findOne(userId, id);
    if (!booking) throw new NotFoundException('Booking not found');
    const { musicFormConfig, musicFormResponse, ...rest } = booking;
    return {
      ...rest,
      hasMusicFormConfig: !!musicFormConfig,
      hasMusicFormResponse: !!musicFormResponse,
    };
  }

  async create(userId: string, dto: CreateBookingDto) {
    if (!dto.formatIds?.length) {
      return this.repo.create(userId, dto);
    }
    const formats = await this.repo.findFormats(userId, dto.formatIds);
    const orderedFormats = dto.formatIds
      .map((id) => formats.find((f) => f.id === id))
      .filter((f): f is NonNullable<typeof f> => f !== null && f !== undefined);
    return this.repo.createWithFormats(userId, dto, orderedFormats);
  }

  async update(userId: string, id: string, dto: UpdateBookingDto) {
    await this.findOne(userId, id);
    return this.repo.update(id, dto);
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
    const { musicFormConfig, musicFormResponse, ...rest } = booking!;
    return { ...rest, hasMusicFormConfig: !!musicFormConfig, hasMusicFormResponse: !!musicFormResponse };
  }

  async removeFormat(userId: string, bookingId: string, bookingFormatId: string) {
    await this.findOne(userId, bookingId);
    const bookingFormat = await this.repo.findBookingFormat(userId, bookingId, bookingFormatId);
    if (!bookingFormat) throw new NotFoundException('Applied format not found');
    const booking = await this.repo.removeFormat(bookingId, bookingFormatId, bookingFormat.performanceFormatId);
    const { musicFormConfig, musicFormResponse, ...rest } = booking!;
    return { ...rest, hasMusicFormConfig: !!musicFormConfig, hasMusicFormResponse: !!musicFormResponse };
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
