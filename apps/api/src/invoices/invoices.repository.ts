import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';
import { allocate, type VoidedInvoiceRef } from './invoice-number-allocator';

export { buildInvoiceNumber, PaddingWidth, InvoiceNumberFormat } from './invoice-number-allocator';

/**
 * Map a voided invoice record to the reuse reference passed to allocate(). allocate() prefers
 * the year embedded in the original invoiceNumber; this issueDate-derived year (falling back to
 * createdAt) is only the fallback for numbers that were issued without a year segment.
 */
function toVoidedRef(
  voided: { invoiceNumber: string | null; issueDate: Date | null; createdAt: Date } | null,
): VoidedInvoiceRef | null {
  if (!voided?.invoiceNumber) return null;
  return { invoiceNumber: voided.invoiceNumber, year: (voided.issueDate ?? voided.createdAt).getFullYear() };
}

export const invoiceIncludes = {
  lineItems: { orderBy: { order: 'asc' } },
  billToContact: true,
} as const;

@Injectable()
export class InvoicesRepository {
  constructor(private prisma: PrismaService) {}

  findBookingCustomerId(
    userId: string,
    bookingId: string,
  ): Promise<string | null> {
    return this.prisma.booking
      .findFirst({ where: { id: bookingId, userId }, select: { customerId: true } })
      .then((b) => b?.customerId ?? null);
  }

  findBookingInfo(
    userId: string,
    bookingId: string,
  ): Promise<{ customerId: string; seriesId: string | null } | null> {
    return this.prisma.booking
      .findFirst({ where: { id: bookingId, userId }, select: { customerId: true, seriesId: true } })
      .then((b) => (b ? { customerId: b.customerId, seriesId: b.seriesId } : null));
  }

  findAll(userId: string, bookingId: string) {
    return this.prisma.invoice.findMany({
      where: { userId, bookingId },
      include: invoiceIncludes,
      orderBy: { issueDate: { sort: 'asc', nulls: 'last' } },
    });
  }

  findOne(userId: string, bookingId: string, id: string) {
    return this.prisma.invoice.findFirst({
      where: { id, userId, bookingId },
      include: invoiceIncludes,
    });
  }

  create(
    userId: string,
    bookingId: string,
    billToContactId: string,
    dto: CreateInvoiceDto,
  ) {
    const { lineItems, billToContactId: _ignored, ...fields } = dto;
    return this.prisma.invoice.create({
      data: {
        userId,
        bookingId,
        billToContactId,
        ...fields,
        lineItems: lineItems?.length
          ? {
              create: lineItems.map((item, i) => ({
                userId,
                ...item,
                order: item.order ?? i,
              })),
            }
          : undefined,
      },
      include: invoiceIncludes,
    });
  }

  update(id: string, dto: UpdateInvoiceDto) {
    return this.prisma.invoice.update({
      where: { id },
      data: dto,
      include: invoiceIncludes,
    });
  }

  delete(id: string) {
    return this.prisma.invoice.delete({ where: { id } });
  }

  voidInvoice(id: string) {
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'VOID' },
      include: invoiceIncludes,
    });
  }

  countActiveByType(bookingId: string, isDeposit: boolean) {
    return this.prisma.invoice.count({
      where: { bookingId, isDeposit, status: { not: 'VOID' } },
    });
  }

  getUserPaymentTerms(userId: string): Promise<number> {
    return this.prisma.userProfile
      .findUnique({ where: { userId }, select: { defaultPaymentTermsDays: true } })
      .then((p) => p?.defaultPaymentTermsDays ?? 14);
  }

  /**
   * Steps 3–5 shared by all assign* methods: find a voided invoice to reuse,
   * resolve the next invoice number, and advance the sequence counter if needed.
   */
  private async allocateInvoiceNumber(
    tx: Prisma.TransactionClient,
    userId: string,
    ownerWhere: Prisma.InvoiceWhereInput,
    orderBy?: Prisma.InvoiceOrderByWithRelationInput,
  ): Promise<string> {
    const currentYear = new Date().getFullYear();

    const voided = await tx.invoice.findFirst({
      where: { ...ownerWhere, userId, status: 'VOID', invoiceNumber: { not: null } },
      select: { invoiceNumber: true, issueDate: true, createdAt: true },
      ...(orderBy ? { orderBy } : {}),
    });

    const profile = await tx.userProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('User profile not found');

    const prefs = (profile.preferences as Record<string, unknown>) ?? {};
    const { invoiceNumber, nextSeq, nextYear } = allocate(
      prefs,
      currentYear,
      profile.invoiceNumberSequence,
      profile.invoiceSequenceYear,
      toVoidedRef(voided),
    );

    if (nextSeq !== profile.invoiceNumberSequence) {
      await tx.userProfile.update({
        where: { userId },
        data: { invoiceNumberSequence: nextSeq, invoiceSequenceYear: nextYear },
      });
    }

    return invoiceNumber;
  }

  private async previewInvoiceNumber(
    userId: string,
    ownerWhere: Prisma.InvoiceWhereInput,
    orderBy?: Prisma.InvoiceOrderByWithRelationInput,
  ): Promise<{ invoiceNumber: string; willReuse: boolean }> {
    const currentYear = new Date().getFullYear();
    const [voided, profile] = await Promise.all([
      this.prisma.invoice.findFirst({
        where: { ...ownerWhere, userId, status: 'VOID', invoiceNumber: { not: null } },
        select: { invoiceNumber: true, issueDate: true, createdAt: true },
        ...(orderBy ? { orderBy } : {}),
      }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
    ]);
    const prefs = (profile?.preferences as Record<string, unknown>) ?? {};
    const seq = profile?.invoiceNumberSequence ?? 0;
    const seqYear = profile?.invoiceSequenceYear ?? currentYear;
    const { invoiceNumber } = allocate(prefs, currentYear, seq, seqYear, toVoidedRef(voided));
    return { invoiceNumber, willReuse: !!voided?.invoiceNumber };
  }

  /**
   * Assign an invoice number and transition the invoice to ISSUED.
   * Idempotent: if the invoice already has a number, only updates dates and status.
   */
  async assignAndMarkIssued(
    userId: string,
    params: { id: string; bookingId: string; isDeposit: boolean; issueDate: Date; dueDate: Date | null },
  ) {
    const { id, bookingId, isDeposit, issueDate, dueDate } = params;

    const existing = await this.prisma.invoice.findUnique({ where: { id }, select: { invoiceNumber: true } });
    if (existing?.invoiceNumber) {
      return this.prisma.invoice.update({
        where: { id },
        data: { issueDate, dueDate, status: 'ISSUED' },
        include: invoiceIncludes,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.allocateInvoiceNumber(tx, userId, { bookingId, isDeposit });
      return tx.invoice.update({
        where: { id },
        data: { invoiceNumber, issueDate, dueDate, status: 'ISSUED' },
        include: invoiceIncludes,
      });
    });
  }

  async assignAndMarkSent(
    userId: string,
    params: { id: string; bookingId: string; isDeposit: boolean; issueDate: Date; dueDate: Date | null },
  ) {
    const { id, bookingId, isDeposit, issueDate, dueDate } = params;

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.allocateInvoiceNumber(tx, userId, { bookingId, isDeposit });
      return tx.invoice.update({
        where: { id },
        data: { invoiceNumber, issueDate, dueDate, status: 'SENT' },
        include: invoiceIncludes,
      });
    });
  }

  async assignInvoiceNumberOnly(
    userId: string,
    params: { id: string; bookingId: string; isDeposit: boolean; issueDate: Date; dueDate: Date | null },
  ) {
    const { id, bookingId, isDeposit, issueDate, dueDate } = params;

    const existing = await this.prisma.invoice.findUnique({ where: { id }, select: { invoiceNumber: true } });
    if (existing?.invoiceNumber) {
      return this.prisma.invoice.update({
        where: { id },
        data: { issueDate, dueDate },
        include: invoiceIncludes,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.allocateInvoiceNumber(tx, userId, { bookingId, isDeposit });
      return tx.invoice.update({
        where: { id },
        data: { invoiceNumber, issueDate, dueDate },
        include: invoiceIncludes,
      });
    });
  }

  markSentById(id: string) {
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'SENT' },
      include: invoiceIncludes,
    });
  }

  assignWithInheritedNumber(id: string, invoiceNumber: string, issueDate: Date, dueDate: Date | null) {
    return this.prisma.invoice.update({
      where: { id },
      data: { invoiceNumber, issueDate, dueDate, status: 'SENT' },
      include: invoiceIncludes,
    });
  }

  async assignNewSequenceNumber(userId: string, invoiceId: string, issueDate: Date, dueDate: Date | null) {
    const currentYear = new Date().getFullYear();
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.userProfile.findUnique({ where: { userId } });
      if (!profile) throw new NotFoundException('User profile not found');

      const prefs = (profile.preferences as Record<string, unknown>) ?? {};
      const { invoiceNumber, nextSeq, nextYear } = allocate(
        prefs,
        currentYear,
        profile.invoiceNumberSequence,
        profile.invoiceSequenceYear,
      );

      await tx.userProfile.update({
        where: { userId },
        data: { invoiceNumberSequence: nextSeq, invoiceSequenceYear: nextYear },
      });

      return tx.invoice.update({
        where: { id: invoiceId },
        data: { invoiceNumber, issueDate, dueDate, status: 'SENT' },
        include: invoiceIncludes,
      });
    });
  }

  /**
   * Assign an invoice number and transition a series invoice to ISSUED.
   * Parallel to assignAndMarkIssued but keyed on seriesId (series invoices have no isDeposit).
   */
  async assignSeriesAndMarkIssued(
    userId: string,
    params: { id: string; seriesId: string; issueDate: Date; dueDate: Date | null },
  ) {
    const { id, seriesId, issueDate, dueDate } = params;

    const existing = await this.prisma.invoice.findUnique({ where: { id }, select: { invoiceNumber: true } });
    if (existing?.invoiceNumber) {
      return this.prisma.invoice.update({
        where: { id },
        data: { issueDate, dueDate, status: 'ISSUED' },
        include: invoiceIncludes,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.allocateInvoiceNumber(tx, userId, { seriesId }, { updatedAt: 'desc' });
      return tx.invoice.update({
        where: { id },
        data: { invoiceNumber, issueDate, dueDate, status: 'ISSUED' },
        include: invoiceIncludes,
      });
    });
  }

  async assignSeriesInvoiceNumberOnly(
    userId: string,
    params: { id: string; seriesId: string; issueDate: Date; dueDate: Date | null },
  ) {
    const { id, seriesId, issueDate, dueDate } = params;

    const existing = await this.prisma.invoice.findUnique({ where: { id }, select: { invoiceNumber: true } });
    if (existing?.invoiceNumber) {
      return this.prisma.invoice.update({
        where: { id },
        data: { issueDate, dueDate },
        include: invoiceIncludes,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.allocateInvoiceNumber(tx, userId, { seriesId }, { updatedAt: 'desc' });
      return tx.invoice.update({
        where: { id },
        data: { invoiceNumber, issueDate, dueDate },
        include: invoiceIncludes,
      });
    });
  }

  markPaidBase(invoiceId: string) {
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
      include: invoiceIncludes,
    });
  }

  setBookingDepositReceivedAt(bookingId: string) {
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { depositReceivedAt: new Date() },
    });
  }

  findLineItem(userId: string, invoiceId: string, itemId: string) {
    return this.prisma.invoiceLineItem.findFirst({
      where: { id: itemId, invoiceId, userId },
    });
  }

  addLineItem(userId: string, invoiceId: string, dto: CreateLineItemDto) {
    return this.prisma.invoiceLineItem.create({
      data: { userId, invoiceId, ...dto },
    });
  }

  updateLineItem(itemId: string, dto: UpdateLineItemDto) {
    return this.prisma.invoiceLineItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  deleteLineItem(itemId: string) {
    return this.prisma.invoiceLineItem.delete({ where: { id: itemId } });
  }

  findDepositInvoice(bookingId: string, userId: string) {
    return this.prisma.invoice.findFirst({
      where: { bookingId, userId, isDeposit: true, status: 'SENT' },
      select: { dueDate: true },
    });
  }

  async previewBookingInvoiceNumber(
    userId: string,
    bookingId: string,
    isDeposit: boolean,
  ): Promise<{ invoiceNumber: string; willReuse: boolean }> {
    return this.previewInvoiceNumber(userId, { bookingId, isDeposit });
  }

  async previewSeriesInvoiceNumber(
    userId: string,
    seriesId: string,
  ): Promise<{ invoiceNumber: string; willReuse: boolean }> {
    return this.previewInvoiceNumber(userId, { seriesId }, { updatedAt: 'desc' });
  }

  // ─── Series-owned Invoice lifecycle CRUD (ADR-0063) ──────────────────────────
  // Invoice is one polymorphic entity; its lifecycle reads/writes live here for both owners.
  // Series-*aggregate* ops (member-booking reconciliation, line append/remove) stay in
  // series.repository — they are membership logic that happens to write invoice lines.

  findActiveSeriesInvoice(userId: string, seriesId: string) {
    return this.prisma.invoice.findFirst({
      where: { seriesId, userId, status: { not: 'VOID' } },
      include: invoiceIncludes,
    });
  }

  findSeriesInvoiceById(userId: string, seriesId: string, invoiceId: string) {
    return this.prisma.invoice.findFirst({
      where: { id: invoiceId, seriesId, userId },
      include: invoiceIncludes,
    });
  }

  createSeriesInvoice(
    userId: string,
    seriesId: string,
    billToContactId: string,
    lineItems: Array<{ description: string; amount: number; order: number; sourceBookingId?: string }>,
  ) {
    return this.prisma.invoice.create({
      data: {
        userId,
        seriesId,
        billToContactId,
        isDeposit: false,
        lineItems: { create: lineItems.map((item) => ({ userId, ...item })) },
      },
      include: invoiceIncludes,
    });
  }

  countNonVoidSeriesInvoices(userId: string, seriesId: string) {
    return this.prisma.invoice.count({
      where: { seriesId, userId, status: { not: 'VOID' } },
    });
  }

  findNonDraftNonVoidSeriesInvoice(userId: string, seriesId: string) {
    return this.prisma.invoice.findFirst({
      where: { seriesId, userId, status: { notIn: ['DRAFT', 'VOID'] } },
      select: { id: true, status: true },
    });
  }
}
