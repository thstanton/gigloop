import type { Invoice } from '@/types/api';

export type InvoiceAction = 'edit' | 'issue' | 'send' | 'markSent' | 'markPaid' | 'void' | 'delete';

/**
 * The endpoint prefix and the TanStack query keys to invalidate for a mutation on
 * `invoice`, derived from its owner FK (ADR-0063: one polymorphic Invoice — exactly
 * one of `seriesId`/`bookingId` is set). A series invoice invalidates its own cache
 * and its stored-document cache — the mirror of the booking side's `bookingDocuments`
 * (#830: issue creates the PDF, void/delete retire it). The rest of a booking invoice's
 * checklist fan-out never fires for a series invoice, by construction. Booking key sets
 * are per-action (they were irregular in the two pre-#724 implementations and are
 * preserved exactly here).
 *
 * `prefix` is a constant, not derived from the owner (#853, ADR-0069): every operation on an
 * invoice that already exists — the nine lifecycle transitions plus payment-correction, edit,
 * and line-item writes — now goes to the owner-agnostic `/invoices/:id` family. Only the cache
 * keys below still branch on owner.
 */
export function invoiceOwnerRoute(
  invoice: Pick<Invoice, 'bookingId' | 'seriesId'>,
  action: InvoiceAction,
): { prefix: string; keys: (string | null)[][] } {
  const prefix = '/invoices';

  if (invoice.seriesId) {
    return {
      prefix,
      // The document query is keyed [seriesInvoiceDocument, seriesId, invoiceId]; TanStack
      // matches by prefix, so the seriesId-only key invalidates it whatever the invoice id.
      keys: [['seriesInvoice', invoice.seriesId], ['seriesInvoiceDocument', invoice.seriesId]],
    };
  }

  const b = invoice.bookingId;
  const keys: Record<InvoiceAction, (string | null)[][]> = {
    // An edit changes only the invoice's own content — no document, no checklist consequence.
    edit: [['bookingInvoices', b]],
    issue: [['bookingInvoices', b], ['bookingDocuments', b], ['bookingChecklist', b]],
    // #847: emailing the invoice transitions it to SENT and logs a Communication against the
    // booking. The series branch above invalidates `bookingCommunications` itself (ADR-0080,
    // useComposeEmail) rather than through this table — a series send has no single bookingId
    // to key a cache entry on, so it invalidates the bare-prefix key covering every booking.
    send: [['bookingInvoices', b], ['bookingDocuments', b], ['bookingChecklist', b], ['bookingCommunications', b]],
    markSent: [['bookingInvoices', b], ['bookingChecklist', b]],
    markPaid: [['bookingInvoices', b], ['booking', b], ['bookingChecklist', b]],
    void: [['bookingInvoices', b], ['bookingChecklist', b]],
    delete: [['bookingInvoices', b]],
  };

  return { prefix, keys: keys[action] };
}
