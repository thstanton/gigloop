import { BadRequestException, Injectable } from '@nestjs/common';
import type { Invoice } from '@prisma/client';
import { InvoicesRepository } from './invoices.repository';
import { DocumentsService, PreloadedInvoice } from '../documents/documents.service';
import { CommunicationsService } from '../communications/communications.service';
import { isSendable, isVoidable, isPayable, InvoiceForRules } from './invoice-transition-rules';
import type { SendInvoiceDto } from './dto/send-invoice.dto';

// The numbered invoice returned by assignNumberOnly: the preloaded shape plus its id.
export type AssignedInvoice = PreloadedInvoice & { id: string };

@Injectable()
export class InvoiceLifecycleService {
  constructor(
    private invoicesRepo: InvoicesRepository,
    private documents: DocumentsService,
    private comms: CommunicationsService,
  ) {}

  /**
   * Send an invoice: generate PDF, store as a Document, email to the client, mark SENT.
   *
   * The `assignNumberOnly` callback is owner-specific — booking and series invoices differ in
   * which voided invoice they look for when inheriting a number. It must leave the invoice in
   * DRAFT after assigning the number so the operation is safely retryable if a later step fails.
   */
  async send(
    userId: string,
    invoice: InvoiceForRules & { id: string; bookingId: string | null },
    dto: SendInvoiceDto,
    assignNumberOnly: (id: string, issueDate: Date, dueDate: Date | null) => Promise<AssignedInvoice>,
  ): Promise<void> {
    if (!isSendable(invoice)) {
      throw new BadRequestException('Only draft invoices can be sent');
    }

    const issueDate = new Date(dto.issueDate);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    // Step 1: assign invoice number (stays DRAFT — idempotent if PDF/email steps fail)
    const numbered = await assignNumberOnly(invoice.id, issueDate, dueDate);

    // Step 2: generate PDF and store as an INVOICE Document (same for booking and series)
    const { buffer: pdfBuffer } = await this.documents.generateAndStoreInvoicePdf(
      userId,
      numbered.id,
      numbered,
      invoice.bookingId ?? undefined,
    );

    // Step 3: send email
    const filename = `${numbered.invoiceNumber ?? 'invoice'}.pdf`;
    await this.comms.sendEmail({
      userId,
      bookingId: invoice.bookingId ?? undefined,
      contactId: dto.contactId,
      to: dto.to,
      subject: dto.subject,
      body: dto.body,
      templateId: dto.templateId,
      attachments: [{ filename, content: pdfBuffer }],
    });

    // Step 4: mark SENT only after all steps succeed
    await this.invoicesRepo.markSentById(invoice.id);
  }

  /**
   * Mark an invoice as sent without emailing.
   * The `atomicMarkSent` callback handles the owner-specific voided-number lookup and
   * atomically assigns the number + transitions to SENT in a single transaction.
   */
  async markSent<T extends Invoice>(
    invoice: InvoiceForRules & { id: string },
    dto: { issueDate: string; dueDate?: string },
    atomicMarkSent: (id: string, issueDate: Date, dueDate: Date | null) => Promise<T>,
  ): Promise<T> {
    if (!isSendable(invoice)) {
      throw new BadRequestException('Only draft invoices can be marked as sent');
    }
    const issueDate = new Date(dto.issueDate);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    return atomicMarkSent(invoice.id, issueDate, dueDate);
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
