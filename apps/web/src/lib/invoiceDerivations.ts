import type { BuiltInTemplateType, Invoice } from '@/types/api';

// Pure, presentational derivations over a single Invoice or a list of them. The Invoice is one
// polymorphic entity (bookingId XOR seriesId, ADR-0029/ADR-0063) — a series invoice has seriesId
// set and isDeposit false. These functions replace the derivations that were duplicated inline
// across InvoiceRow, InvoiceSection, useChecklistActions and composeHelpers.

/** Row label for an invoice. A series invoice (seriesId set) is neither deposit nor balance. */
export function invoiceLabel(invoice: Invoice): string {
  if (invoice.seriesId) return 'Series invoice';
  return invoice.isDeposit ? 'Deposit' : 'Balance';
}

/** Overdue only applies to SENT invoices — an ISSUED invoice past its due date is not overdue. */
export function isInvoiceOverdue(invoice: Invoice): boolean {
  return invoice.status === 'SENT' && !!invoice.dueDate && new Date(invoice.dueDate) < new Date();
}

/** Deposit amount for a fee at the given deposit percentage, rounded to pence. */
export function depositAmount(fee: number, pct: number): number {
  return Math.round((fee * pct / 100) * 100) / 100;
}

/** Balance amount for a fee at the given deposit percentage, rounded to pence. */
export function balanceAmount(fee: number, pct: number): number {
  return Math.round((fee * (1 - pct / 100)) * 100) / 100;
}

/**
 * #758: a deposit amount is pre-filled from fee × default-deposit-%. When the booking has a
 * positive fee but no default percentage is set, the amount lands blank — the signal to nudge the
 * user to set a default so future deposits pre-fill. Returns false until the profile is known, so
 * the hint never flashes before we can tell whether a default exists. `fee` is the Decimal-string
 * off the booking; a null/blank/zero fee is a different gap (out of scope) and yields false.
 */
export function isDepositPercentageHintEligible(
  fee: string | null,
  profile: { depositPercentage: number | null } | null | undefined,
): boolean {
  if (!profile || profile.depositPercentage != null) return false;
  return !!fee && parseFloat(fee) > 0;
}

/**
 * Cover-email template for sending an invoice. A series invoice has isDeposit false, so it resolves
 * to the balance cover — preserving today's hardcoded series send.
 */
export function coverTemplateFor(invoice: Invoice): BuiltInTemplateType {
  return invoice.isDeposit ? 'deposit_invoice_cover' : 'balance_invoice_cover';
}

/** The active (non-VOID) invoice of the given kind, or undefined. */
export function activeInvoiceOf(isDeposit: boolean, invoices: Invoice[]): Invoice | undefined {
  return invoices.find((inv) => inv.isDeposit === isDeposit && inv.status !== 'VOID');
}

/** The SENT invoice of the given kind, or undefined. */
export function sentInvoiceOf(isDeposit: boolean, invoices: Invoice[]): Invoice | undefined {
  return invoices.find((inv) => inv.isDeposit === isDeposit && inv.status === 'SENT');
}
