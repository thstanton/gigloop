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
  async issueInvoice(
    userId: string,
    invoice: InvoiceForRules & { id: string; bookingId: string | null },
    params: { issueDate: Date; dueDate: Date | null },
    assignAndMarkIssued: (id: string, issueDate: Date, dueDate: Date | null) => Promise<AssignedInvoice>,
  ): Promise<void> {
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
  }

  /**
   * Send an invoice: attach the stored PDF and email it to the client, then mark SENT.
   *
   * For ISSUED invoices (the normal booking invoice flow), the PDF is retrieved from storage —
   * it is never regenerated, ensuring what was previewed = what is stored = what the client receives.
   *
   * For DRAFT invoices (series compat — series invoices have not yet gained the ISSUED state),
   * the legacy flow applies: assign number, generate + store PDF, send, mark SENT.
   * The `assignNumberOnly` callback is required for this path.
   */
  async send(
    userId: string,
    invoice: InvoiceForRules & { id: string; bookingId: string | null },
    dto: SendInvoiceDto,
    assignNumberOnly?: (id: string, issueDate: Date, dueDate: Date | null) => Promise<AssignedInvoice>,
  ): Promise<void> {
    if (!isSendable(invoice)) {
      throw new BadRequestException('Only issued (or draft) invoices can be sent');
    }
    const { buffer: pdfBuffer, invoiceNumber, documentId } = await this.resolvePdfForSend(userId, invoice, dto, assignNumberOnly);
    await this.comms.sendEmail({
      userId,
      bookingId: invoice.bookingId ?? undefined,
      contactId: dto.contactId,
      to: dto.to,
      subject: dto.subject,
      body: dto.body,
      templateId: dto.templateId,
      attachments: [{ filename: `${invoiceNumber ?? 'invoice'}.pdf`, content: pdfBuffer }],
      documentId: documentId ?? undefined,
    });
    await this.invoicesRepo.markSentById(invoice.id);
  }

  // Fetches the PDF buffer and final invoice number without changing invoice state.
  // ISSUED: serves the already-stored PDF. DRAFT: assigns number and generates a new PDF.
  private async resolvePdfForSend(
    userId: string,
    invoice: InvoiceForRules & { id: string; bookingId: string | null },
    dto: SendInvoiceDto,
    assignNumberOnly?: (id: string, issueDate: Date, dueDate: Date | null) => Promise<AssignedInvoice>,
  ): Promise<{ buffer: Buffer; invoiceNumber: string | null; documentId: string | null }> {
    if (invoice.status === 'ISSUED') {
      const result = await this.documents.getStoredInvoicePdfBuffer(userId, invoice.id);
      if (!result) throw new BadRequestException('Issued invoice has no stored PDF — cannot send');
      return { buffer: result.buffer, invoiceNumber: invoice.invoiceNumber, documentId: result.documentId };
    }
    if (!assignNumberOnly) throw new BadRequestException('assignNumberOnly required for draft invoices');
    if (!dto.issueDate) throw new BadRequestException('issueDate is required for draft invoices');
    const issueDate = new Date(dto.issueDate);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const numbered = await assignNumberOnly(invoice.id, issueDate, dueDate);
    const { buffer, documentId } = await this.documents.generateAndStoreInvoicePdf(
      userId,
      numbered.id,
      numbered,
      invoice.bookingId ?? undefined,
    );
    return { buffer, invoiceNumber: numbered.invoiceNumber, documentId };
  }

  /**
   * Mark an invoice as sent without emailing.
   *
   * For ISSUED invoices: simply transitions to SENT (number and dates are already set).
   * For DRAFT invoices (series compat): the `atomicMarkSent` callback assigns the number
   * and transitions to SENT atomically. The callback and dates are required in this case.
   */
  async markSent(
    invoice: InvoiceForRules & { id: string },
    dto: { issueDate?: string; dueDate?: string },
    atomicMarkSent?: (id: string, issueDate: Date, dueDate: Date | null) => Promise<Invoice>,
  ): Promise<Invoice> {
    if (!isSendable(invoice)) {
      throw new BadRequestException('Only issued (or draft) invoices can be marked as sent');
    }
    if (invoice.status === 'ISSUED') {
      return this.invoicesRepo.markSentById(invoice.id);
    }
    // DRAFT path (series compat): require the callback and dates
    if (!atomicMarkSent) throw new BadRequestException('atomicMarkSent required for draft invoices');
    if (!dto.issueDate) throw new BadRequestException('issueDate is required for draft invoices');
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
