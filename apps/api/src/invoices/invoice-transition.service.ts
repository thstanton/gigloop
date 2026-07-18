import { BadRequestException, Injectable } from '@nestjs/common';
import type { Invoice } from '@prisma/client';
import { InvoicesRepository } from './invoices.repository';
import { DocumentsService } from '../documents/documents.service';
import { CommunicationsService } from '../communications/communications.service';
import { ChecklistReevaluator } from '../checklist/checklist-reevaluator.service';
import { ChecklistRepository } from '../checklist/checklist.repository';
import { isIssuable, isSendable, isVoidable, isPayable, InvoiceForRules } from './invoice-transition-rules';
import type { SendInvoiceDto } from './dto/send-invoice.dto';
import type { IssueInvoiceDto } from './dto/issue-invoice.dto';
import type { MarkSentDto } from './dto/mark-sent.dto';

/**
 * The Invoice fields the transition service derives every side-effect from. Invoice is one
 * polymorphic entity (ADR-0029): exactly one of `bookingId` / `seriesId` is set. Every
 * booking-shaped side-effect — deposit stamp, checklist reset, affected-booking re-evaluation,
 * and number allocation — reads these fields, so a series invoice (`bookingId` null) no-ops the
 * booking-shaped ones *by construction* (ADR-0063).
 */
export type TransitionInvoice = InvoiceForRules & {
  id: string;
  bookingId: string | null;
  seriesId: string | null;
  isDeposit: boolean;
};

/**
 * The single home for an Invoice's lifecycle transitions — issue / send / mark-sent / mark-paid /
 * void — and their side-effects. Owner services (booking, series) fetch the owner-scoped invoice
 * and hand it here; the transition and everything it triggers happen in one place, field-derived,
 * with zero owner-specific callbacks (ADR-0063). It deliberately does *not* own `create` or the
 * create-time "one active invoice" guard — those genuinely differ between owners.
 */
@Injectable()
export class InvoiceTransitionService {
  constructor(
    private invoicesRepo: InvoicesRepository,
    private documents: DocumentsService,
    private comms: CommunicationsService,
    private reeval: ChecklistReevaluator,
    private checklistRepo: ChecklistRepository,
  ) {}

  /**
   * Resolve the issue/due dates for an issue transition. Issue date defaults to today; due date
   * defaults to issue date + the user's payment terms (skipped when terms are 0). Shared by both
   * owners — previously copy-pasted into each owner service.
   */
  private async resolveIssueDates(
    userId: string,
    dto: IssueInvoiceDto,
  ): Promise<{ issueDate: Date; dueDate: Date | null }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : today;

    let dueDate: Date | null = null;
    if (dto.dueDate) {
      dueDate = new Date(dto.dueDate);
    } else {
      const terms = await this.invoicesRepo.getUserPaymentTerms(userId);
      if (terms > 0) {
        dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + terms);
      }
    }
    return { issueDate, dueDate };
  }

  /**
   * Issue a draft invoice: resolve dates, allocate the invoice number + mark ISSUED, generate +
   * store the PDF, and re-evaluate the affected booking. Number allocation is field-derived —
   * a series invoice allocates on its series, a booking invoice on its booking + isDeposit.
   *
   * The write returns the fully-hydrated invoice (same shape as the owner's findOne), so callers
   * return it directly without re-fetching (#591); PDF generation reads it but never mutates it.
   */
  async issueInvoice(userId: string, invoice: TransitionInvoice, dto: IssueInvoiceDto) {
    if (!isIssuable(invoice)) {
      throw new BadRequestException('Only draft invoices can be issued');
    }

    const { issueDate, dueDate } = await this.resolveIssueDates(userId, dto);

    const issued = invoice.seriesId
      ? await this.invoicesRepo.assignSeriesAndMarkIssued(userId, {
          id: invoice.id,
          seriesId: invoice.seriesId,
          issueDate,
          dueDate,
        })
      : await this.invoicesRepo.assignAndMarkIssued(userId, {
          id: invoice.id,
          // Polymorphic invariant (ADR-0029): no seriesId ⇒ bookingId is set.
          bookingId: invoice.bookingId!,
          isDeposit: invoice.isDeposit,
          issueDate,
          dueDate,
        });

    await this.documents.generateAndStoreInvoicePdf(
      userId,
      issued.id,
      issued,
      invoice.bookingId ?? undefined,
    );

    if (invoice.bookingId) {
      await this.reeval.onBookingChanged(invoice.bookingId);
    }

    return issued;
  }

  /**
   * Send an invoice: retrieve the stored PDF and email it to the client, then mark SENT.
   *
   * Only ISSUED invoices can be sent — the PDF was stored at issue time, so what was
   * previewed = what is in Documents = what the client receives.
   */
  async send(userId: string, invoice: TransitionInvoice, dto: SendInvoiceDto): Promise<void> {
    if (!isSendable(invoice)) {
      throw new BadRequestException('Only issued invoices can be sent');
    }
    const result = await this.documents.getStoredInvoicePdfBuffer(userId, invoice.id);
    if (!result) throw new BadRequestException('Issued invoice has no stored PDF — cannot send');
    await this.comms.sendEmail({
      userId,
      bookingId: invoice.bookingId ?? undefined,
      contactId: dto.contactId,
      to: dto.to,
      subject: dto.subject,
      body: dto.body,
      templateId: dto.templateId,
      attachments: [{ filename: `${invoice.invoiceNumber ?? 'invoice'}.pdf`, content: result.buffer }],
      documentId: result.documentId ?? undefined,
    });
    await this.invoicesRepo.markSentById(invoice.id);
  }

  /**
   * Mark an ISSUED invoice as sent without emailing.
   * Number and dates are already set at issue time — this simply transitions to SENT.
   */
  async markSent(invoice: TransitionInvoice, _dto: MarkSentDto): Promise<Invoice> {
    if (!isSendable(invoice)) {
      throw new BadRequestException('Only issued invoices can be marked as sent');
    }
    return this.invoicesRepo.markSentById(invoice.id);
  }

  /**
   * Mark a SENT invoice as paid. Side-effects are field-derived: a deposit booking invoice stamps
   * `booking.depositReceivedAt` and re-evaluates its checklist; a series invoice (bookingId null)
   * does neither, by construction.
   */
  async markPaid(invoice: TransitionInvoice): Promise<Invoice> {
    if (!isPayable(invoice)) {
      throw new BadRequestException('Only sent invoices can be marked as paid');
    }
    const result = await this.invoicesRepo.markPaidBase(invoice.id);
    if (invoice.isDeposit && invoice.bookingId) {
      await this.invoicesRepo.setBookingDepositReceivedAt(invoice.bookingId);
    }
    if (invoice.bookingId) {
      await this.reeval.onBookingChanged(invoice.bookingId);
    }
    return result;
  }

  /**
   * Void an invoice. Side-effects are field-derived: for a booking invoice, if no active invoice
   * of the same type remains, reset its create-invoice checklist item, then re-evaluate. A series
   * invoice (bookingId null) touches no checklist, by construction — there is no booking-shaped
   * side-effect for it to have.
   */
  async voidInvoice(invoice: TransitionInvoice): Promise<Invoice> {
    if (!isVoidable(invoice)) {
      if (invoice.status === 'VOID') {
        throw new BadRequestException('Invoice is already VOID');
      }
      throw new BadRequestException('Draft invoices cannot be voided — delete them instead');
    }
    const result = await this.invoicesRepo.voidInvoice(invoice.id);
    if (invoice.bookingId) {
      await this.reopenCreateInvoiceItemIfLast(invoice.bookingId, invoice.isDeposit);
      await this.reeval.onBookingChanged(invoice.bookingId);
    }
    return result;
  }

  /**
   * After voiding a booking invoice, re-open its create-invoice checklist item if no active
   * invoice of that type remains — so the musician is prompted to raise a replacement.
   */
  private async reopenCreateInvoiceItemIfLast(bookingId: string, isDeposit: boolean): Promise<void> {
    const remaining = await this.invoicesRepo.countActiveByType(bookingId, isDeposit);
    if (remaining === 0) {
      const checklistKey = isDeposit ? 'create_deposit_invoice' : 'create_balance_invoice';
      await this.checklistRepo.resetItemByKey(bookingId, checklistKey);
    }
  }
}
