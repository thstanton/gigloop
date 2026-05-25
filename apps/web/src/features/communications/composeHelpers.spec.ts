import { describe, it, expect } from 'vitest';
import { getInvoiceIdForTemplate, shouldHideTemplate, formatMissingVariables } from './composeHelpers';
import type { Invoice } from '@/types/api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    bookingId: 'b1',
    userId: 'u1',
    status: 'DRAFT',
    isDeposit: false,
    issueDate: '2025-01-01',
    dueDate: null,
    billToContactId: null,
    lineItems: [],
    ...overrides,
  } as unknown as Invoice;
}

const depositInvoice = makeInvoice({ id: 'dep-1', isDeposit: true });
const balanceInvoice = makeInvoice({ id: 'bal-1', isDeposit: false });

const PAST_DATE = '2020-01-01';
const FUTURE_DATE = '2099-01-01';

// ─── getInvoiceIdForTemplate ──────────────────────────────────────────────────

describe('getInvoiceIdForTemplate', () => {
  const invoices = [depositInvoice, balanceInvoice];

  it('returns deposit invoice id for deposit_invoice_cover', () => {
    expect(getInvoiceIdForTemplate('deposit_invoice_cover', invoices)).toBe('dep-1');
  });

  it('returns deposit invoice id for contract_and_deposit_cover', () => {
    expect(getInvoiceIdForTemplate('contract_and_deposit_cover', invoices)).toBe('dep-1');
  });

  it('returns balance invoice id for balance_invoice_cover', () => {
    expect(getInvoiceIdForTemplate('balance_invoice_cover', invoices)).toBe('bal-1');
  });

  it('returns undefined for email templates that do not need an invoice', () => {
    const nonInvoiceTypes = ['quote', 'confirmation', 'contract_cover', 'contract_received',
      'deposit_received', 'music_form_invite', 'thank_you'] as const;
    for (const type of nonInvoiceTypes) {
      expect(getInvoiceIdForTemplate(type, invoices)).toBeUndefined();
    }
  });

  it('returns undefined when no deposit invoice exists for deposit_invoice_cover', () => {
    expect(getInvoiceIdForTemplate('deposit_invoice_cover', [balanceInvoice])).toBeUndefined();
  });

  it('returns undefined when no balance invoice exists for balance_invoice_cover', () => {
    expect(getInvoiceIdForTemplate('balance_invoice_cover', [depositInvoice])).toBeUndefined();
  });

  it('returns undefined for null template type', () => {
    expect(getInvoiceIdForTemplate(null, invoices)).toBeUndefined();
  });

  it('returns undefined for empty invoice list', () => {
    expect(getInvoiceIdForTemplate('deposit_invoice_cover', [])).toBeUndefined();
    expect(getInvoiceIdForTemplate('balance_invoice_cover', [])).toBeUndefined();
  });

  it('returns the first matching deposit invoice when multiple exist', () => {
    const second = makeInvoice({ id: 'dep-2', isDeposit: true });
    const result = getInvoiceIdForTemplate('deposit_invoice_cover', [depositInvoice, second]);
    expect(result).toBe('dep-1');
  });
});

// ─── shouldHideTemplate ───────────────────────────────────────────────────────

describe('shouldHideTemplate', () => {
  const invoices = [depositInvoice, balanceInvoice];

  it('does not hide non-invoice templates regardless of invoices', () => {
    const unaffected = ['quote', 'confirmation', 'contract_cover', 'contract_received',
      'deposit_received', 'music_form_invite'] as const;
    for (const type of unaffected) {
      expect(shouldHideTemplate(type, [], PAST_DATE)).toBe(false);
    }
  });

  it('hides deposit_invoice_cover when no deposit invoice exists', () => {
    expect(shouldHideTemplate('deposit_invoice_cover', [balanceInvoice], PAST_DATE)).toBe(true);
  });

  it('shows deposit_invoice_cover when deposit invoice exists', () => {
    expect(shouldHideTemplate('deposit_invoice_cover', invoices, PAST_DATE)).toBe(false);
  });

  it('hides contract_and_deposit_cover when no deposit invoice exists', () => {
    expect(shouldHideTemplate('contract_and_deposit_cover', [balanceInvoice], PAST_DATE)).toBe(true);
  });

  it('shows contract_and_deposit_cover when deposit invoice exists', () => {
    expect(shouldHideTemplate('contract_and_deposit_cover', invoices, PAST_DATE)).toBe(false);
  });

  it('hides balance_invoice_cover when no balance invoice exists', () => {
    expect(shouldHideTemplate('balance_invoice_cover', [depositInvoice], PAST_DATE)).toBe(true);
  });

  it('shows balance_invoice_cover when balance invoice exists', () => {
    expect(shouldHideTemplate('balance_invoice_cover', invoices, PAST_DATE)).toBe(false);
  });

  it('hides thank_you when booking date is in the future', () => {
    expect(shouldHideTemplate('thank_you', invoices, FUTURE_DATE)).toBe(true);
  });

  it('shows thank_you when booking date is in the past', () => {
    expect(shouldHideTemplate('thank_you', invoices, PAST_DATE)).toBe(false);
  });

  it('hides thank_you for today (date not yet passed)', () => {
    const today = new Date().toISOString();
    expect(shouldHideTemplate('thank_you', invoices, today)).toBe(true);
  });
});

// ─── formatMissingVariables ───────────────────────────────────────────────────

describe('formatMissingVariables', () => {
  it('returns the label for a single variable', () => {
    expect(formatMissingVariables(['bookingDate'])).toBe('Booking date');
  });

  it('joins two variables with "and"', () => {
    expect(formatMissingVariables(['bookingDate', 'venueName'])).toBe('Booking date and Venue name');
  });

  it('joins three variables with Oxford comma', () => {
    expect(formatMissingVariables(['bookingDate', 'venueName', 'customerName'])).toBe(
      'Booking date, Venue name, and Customer name',
    );
  });

  it('joins four variables with Oxford comma', () => {
    expect(formatMissingVariables(['bookingDate', 'venueName', 'customerName', 'invoiceTotal'])).toBe(
      'Booking date, Venue name, Customer name, and Invoice total',
    );
  });

  it('uses the raw key when VAR_LABELS has no entry', () => {
    expect(formatMissingVariables(['unknownKey'])).toBe('unknownKey');
  });

  it('handles all known variable keys without throwing', () => {
    const keys = ['customerName', 'bookingDate', 'venueName', 'bookingFee', 'setsSchedule',
      'musicianName', 'musicianEmail', 'portalLink', 'invoiceNumber', 'issueDate',
      'invoiceTotal', 'invoiceDueDate'];
    expect(() => formatMissingVariables(keys)).not.toThrow();
    const result = formatMissingVariables(keys);
    expect(result).toContain('Customer name');
    expect(result).toContain('Invoice total');
  });
});
