import { BadRequestException, Injectable } from '@nestjs/common';
import type { Invoice } from '@prisma/client';
import { InvoicesRepository } from './invoices.repository';
import { DocumentsService, PreloadedInvoice } from '../documents/documents.service';
import { CommunicationsService } from '../communications/communications.service';
import { isIssuable, isSendable, isVoidable, isPayable, InvoiceForRules } from './invoice-transition-rules';
import type { SendInvoiceDto } from './dto/send-invoice.dto';

// The numbered invoice returned by assignAndMarkIssued / assignNumberOnly: the preloaded shape plus its id.
export type AssignedInvoice = PreloadedInvoice & { id: string };

@Injectable()
export class InvoiceLifecycleService {
  constructor(
    private invoicesRepo: InvoicesRepository,
    private documents: DocumentsService,
    private comms: CommunicationsService,
  ) {}

  /**
   * Issue a draft invoice: assign invoice number, set dates, lock line items,
   * and generate + store the PDF as an INVOICE Document.
   *
   * The `assignAndMarkIssued` callback is owner-specific — booking and series invoices
   * differ in how they look up a voided number for reuse.
   */
  async issueInvoice<T extends AssignedInvoice>(
    userId: string,
    invoice: InvoiceForRules & { id: string; bookingId: string | null },
    params: { issueDate: Date; dueDate: Date | null },
    assignAndMarkIssued: (id: string, issueDate: Date, dueDate: Date | null) => Promise<T>,
  ): Promise<T> {
    if (!isIssuable(invoice)) {
      throw new BadRequestException('Only draft invoices can be issued');
    }
    const issued = await assignAndMarkIssued(invoice.id, params.issueDate, params.dueDate);
    await this.documents.generateAndStoreInvoicePdf(
      userId,
      issued.id,
      issued,
      invoice.bookingId ?? undefined,
    );
    // Return the written entity so callers don't re-fetch it (#591). T is the callback's actual
    // return type — the booking/series assign methods both hydrate `invoiceIncludes`, so the full
    // invoice flows back; the PDF generator above only reads the leaner AssignedInvoice subset.
    return issued;
  }

  /**
   * Send an invoice: retrieve the stored PDF and email it to the client, then mark SENT.
   *
   * Only ISSUED invoices can be sent — the PDF was stored at issue time, so what was
   * previewed = what is in Documents = what the client receives.
   */
  async send(
    userId: string,
    invoice: InvoiceForRules & { id: string; bookingId: string | null },
    dto: SendInvoiceDto,
  ): Promise<void> {
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
  async markSent(
    invoice: InvoiceForRules & { id: string },
    _dto: { issueDate?: string; dueDate?: string },
  ): Promise<Invoice> {
    if (!isSendable(invoice)) {
      throw new BadRequestException('Only issued invoices can be marked as sent');
    }
    return this.invoicesRepo.markSentById(invoice.id);
  }

  /**
   * Mark an invoice as paid.
   * An optional `onCommit` callback runs after the invoice is updated — use it for
   * owner-specific side effects (e.g. booking.depositReceivedAt, checklist evaluation).
   */
  async markPaid(
    invoice: InvoiceForRules & { id: string },
    onCommit?: () => Promise<void>,
  ): Promise<Invoice> {
    if (!isPayable(invoice)) {
      throw new BadRequestException('Only sent invoices can be marked as paid');
    }
    const result = await this.invoicesRepo.markPaidBase(invoice.id);
    if (onCommit) await onCommit();
    return result;
  }

  /**
   * Void an invoice. Caller handles any owner-specific side effects (e.g. checklist reset)
   * after this returns.
   */
  async voidInvoice(invoice: InvoiceForRules & { id: string }): Promise<Invoice> {
    if (!isVoidable(invoice)) {
      if (invoice.status === 'VOID') {
        throw new BadRequestException('Invoice is already VOID');
      }
      throw new BadRequestException('Draft invoices cannot be voided — delete them instead');
    }
    return this.invoicesRepo.voidInvoice(invoice.id);
  }
}
