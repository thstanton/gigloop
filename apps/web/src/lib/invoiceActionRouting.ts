import type { Invoice } from '@/types/api';

export type InvoiceAction = 'issue' | 'markSent' | 'markPaid' | 'void' | 'delete';

/**
 * The endpoint prefix and the TanStack query keys to invalidate for a mutation on
 * `invoice`, derived from its owner FK (ADR-0063: one polymorphic Invoice — exactly
 * one of `seriesId`/`bookingId` is set). A series invoice invalidates its own cache
 * and its stored-document cache — the mirror of the booking side's `bookingDocuments`
 * (#830: issue creates the PDF, void/delete retire it). The rest of a booking invoice's
 * checklist fan-out never fires for a series invoice, by construction. Booking key sets
 * are per-action (they were irregular in the two pre-#724 implementations and are
 * preserved exactly here).
 */
export function invoiceOwnerRoute(
  invoice: Pick<Invoice, 'bookingId' | 'seriesId'>,
  action: InvoiceAction,
): { prefix: string; keys: (string | null)[][] } {
  if (invoice.seriesId) {
    return {
      prefix: `/series/${invoice.seriesId}/invoices`,
      // The document query is keyed [seriesInvoiceDocument, seriesId, invoiceId]; TanStack
      // matches by prefix, so the seriesId-only key invalidates it whatever the invoice id.
      keys: [['seriesInvoice', invoice.seriesId], ['seriesInvoiceDocument', invoice.seriesId]],
    };
  }

  const b = invoice.bookingId;
  const keys: Record<InvoiceAction, (string | null)[][]> = {
    issue: [['bookingInvoices', b], ['bookingDocuments', b], ['bookingChecklist', b]],
    markSent: [['bookingInvoices', b], ['bookingChecklist', b]],
    markPaid: [['bookingInvoices', b], ['booking', b], ['bookingChecklist', b]],
    void: [['bookingInvoices', b], ['bookingChecklist', b]],
    delete: [['bookingInvoices', b]],
  };

  return { prefix: `/bookings/${b}/invoices`, keys: keys[action] };
}
