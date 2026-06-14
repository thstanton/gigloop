// Pure predicates — no imports, no side effects.
// Single source of truth for which invoice actions are legal in each state.

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'VOID';

export interface InvoiceForRules {
  status: InvoiceStatus;
  invoiceNumber: string | null;
}

/** True when the invoice can be sent or marked-sent (status is DRAFT). */
export const isSendable = (i: InvoiceForRules): boolean => i.status === 'DRAFT';

/**
 * True when the invoice can be voided.
 * An invoice is voidable once it has been numbered and is not already VOID.
 * A DRAFT (unnumbered) must be deleted, not voided; a numbered DRAFT must also be deleted
 * rather than voided, to keep the flow consistent with the current lifecycle.
 */
export const isVoidable = (i: InvoiceForRules): boolean =>
  i.invoiceNumber !== null && i.status !== 'DRAFT' && i.status !== 'VOID';

/** True when the invoice can be marked paid (status is SENT). */
export const isPayable = (i: InvoiceForRules): boolean => i.status === 'SENT';

/** True when line items and metadata can still be edited (status is DRAFT). */
export const isEditable = (i: InvoiceForRules): boolean => i.status === 'DRAFT';

/** True when the invoice can be deleted (only before a number is assigned). */
export const isDeletable = (i: InvoiceForRules): boolean => i.status === 'DRAFT';
