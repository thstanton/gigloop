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

/**
 * The **invoiced deposit** on a booking: the line-item total of its active (non-VOID) deposit
 * invoice, or **0** when there is none. Read from the invoice, never from `depositPercentage` —
 * see CONTEXT.md → Invoice → "Invoiced deposit — one rule, two consumers". A VOID-only deposit
 * counts as zero (via `activeInvoiceOf`). Rounded to pence. `amount` is a Decimal string.
 */
export function invoicedDeposit(invoices: Invoice[]): number {
  const deposit = activeInvoiceOf(true, invoices);
  if (!deposit) return 0;
  const total = deposit.lineItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Default pre-filled amount for a **balance** invoice = booking fee − invoiced deposit, rounded to
 * pence. Reads the actual deposit invoice, so a booking with no (or only a VOID) deposit pre-fills
 * at the full fee. Not clamped: a fee reduced below an already-raised deposit yields a negative
 * default on purpose — that discrepancy is the signal the rule exists to surface.
 */
export function balanceDefaultAmount(fee: number, invoices: Invoice[]): number {
  return Math.round((fee - invoicedDeposit(invoices)) * 100) / 100;
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
 * Cover-email template for sending an invoice, derived from its owner FK first (ADR-0063: one
 * polymorphic Invoice). The owner check must come first: a series invoice also has `isDeposit`
 * false, so keying on that alone silently resolved it to the *balance* cover — wrong three times
 * over for a residency invoice (#846), and the reason a series invoice could not be sent at all
 * (#847). Every path that pre-selects a cover template goes through here, so the row menu and the
 * issue-then-send chain out of InvoiceSheet cannot disagree.
 */
export function coverTemplateFor(invoice: Invoice): BuiltInTemplateType {
  if (invoice.seriesId) return 'series_invoice_cover';
  return invoice.isDeposit ? 'deposit_invoice_cover' : 'balance_invoice_cover';
}

/** The active (non-VOID) invoice of the given kind, or undefined. */
export function activeInvoiceOf(isDeposit: boolean, invoices: Invoice[]): Invoice | undefined {
  return invoices.find((inv) => inv.isDeposit === isDeposit && inv.status !== 'VOID');
}

/**
 * Whether a deposit invoice exists in **any** state, including VOID (#756). This is what the
 * contract-send shortcut checks to decide which cover to pre-select — the combined "Contract &
 * deposit email" when one exists, otherwise the plain contract cover (`contractCoverTemplateFor`).
 * Deliberately distinct from `activeInvoiceOf(true, …)`, which asks whether a *usable* (non-void)
 * deposit invoice exists — that is the right question for a hint about attaching one, but the
 * wrong one for the shortcut's pre-selection.
 *
 * Not a visibility gate: the compose picker (`isComposableEmailTemplate`) offers every
 * invoice-cover template regardless of invoice presence and warns on a missing attachment instead
 * (`getAttachmentState`) — see #928.
 */
export function hasAnyDepositInvoice(invoices: Invoice[]): boolean {
  return invoices.some((inv) => inv.isDeposit);
}

/**
 * The cover-email template the contract-send shortcut pre-selects (#756). When a deposit invoice
 * exists it offers the combined "Contract & deposit email"; otherwise the plain contract cover.
 * Keyed off `hasAnyDepositInvoice` so both booking-detail layouts derive it identically.
 */
export function contractCoverTemplateFor(
  invoices: Invoice[],
): 'contract_and_deposit_cover' | 'contract_cover' {
  return hasAnyDepositInvoice(invoices) ? 'contract_and_deposit_cover' : 'contract_cover';
}

/** The SENT invoice of the given kind, or undefined. */
export function sentInvoiceOf(isDeposit: boolean, invoices: Invoice[]): Invoice | undefined {
  return invoices.find((inv) => inv.isDeposit === isDeposit && inv.status === 'SENT');
}
