// Pure predicates — no imports, no side effects.
// Single source of truth for which invoice actions are legal in each state.

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'VOID';

export interface InvoiceForRules {
  status: InvoiceStatus;
  invoiceNumber: string | null;
}

/** True when the invoice is a draft and can be issued (DRAFT → ISSUED). */
export const isIssuable = (i: InvoiceForRules): boolean => i.status === 'DRAFT';

/**
 * True when a prior issue committed the number + dates but a downstream failure (PDF render, R2
 * write) never produced a Document, leaving the invoice ISSUED and stranded — un-reissuable and
 * un-sendable (#849, ADR-0070). This is a repair, not a re-issue: the number, issue date and due
 * date stay frozen; only the missing artifact is regenerated. The moment a Document exists the
 * invoice is frozen again and this closes. `hasDocument` is supplied by the caller — this predicate
 * stays pure and never fetches it itself.
 */
export const isRepairableIssue = (i: InvoiceForRules, hasDocument: boolean): boolean =>
  i.status === 'ISSUED' && !hasDocument;

/** True when the invoice can be sent or marked-sent (status is ISSUED). */
export const isSendable = (i: InvoiceForRules): boolean => i.status === 'ISSUED';

/**
 * True when the invoice can be voided.
 * Any numbered invoice that is not already VOID is voidable — this covers ISSUED, SENT, and PAID.
 * Unnumbered DRAFTs must be deleted, not voided.
 */
export const isVoidable = (i: InvoiceForRules): boolean =>
  i.invoiceNumber !== null && i.status !== 'DRAFT' && i.status !== 'VOID';

/** True when the invoice can be marked paid (status is SENT). */
export const isPayable = (i: InvoiceForRules): boolean => i.status === 'SENT';

/**
 * True when the recorded payment (date + reference) can be corrected — the invoice is already PAID
 * (ADR-0068 / TIM-46). Correcting the payment fact never changes status; the document stays locked.
 */
export const isPaymentCorrectable = (i: InvoiceForRules): boolean => i.status === 'PAID';

/** True when line items and metadata can still be edited (status is DRAFT). */
export const isEditable = (i: InvoiceForRules): boolean => i.status === 'DRAFT';

/** True when the invoice can be deleted (only unnumbered DRAFTs; any numbered invoice must be voided). */
export const isDeletable = (i: InvoiceForRules): boolean => i.status === 'DRAFT';
