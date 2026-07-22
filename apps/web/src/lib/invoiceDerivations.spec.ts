import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  invoiceLabel,
  isInvoiceOverdue,
  depositAmount,
  balanceAmount,
  coverTemplateFor,
  activeInvoiceOf,
  sentInvoiceOf,
  hasAnyDepositInvoice,
  contractCoverTemplateFor,
  isDepositPercentageHintEligible,
} from './invoiceDerivations';
import type { Invoice } from '@/types/api';

const base: Invoice = {
  id: 'inv1',
  createdAt: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
  status: 'DRAFT',
  isDeposit: false,
  invoiceNumber: null,
  issueDate: null,
  dueDate: null,
  paidAt: null,
  bookingId: 'b1',
  seriesId: null,
  billToContactId: 'c1',
  // billToContact/lineItems are irrelevant to these derivations.
  billToContact: {} as Invoice['billToContact'],
  lineItems: [],
};

const make = (o: Partial<Invoice>): Invoice => ({ ...base, ...o });

describe('invoiceLabel', () => {
  it('labels a series invoice "Series invoice" regardless of isDeposit', () => {
    // The load-bearing behaviour change (#687): a series invoice used to render "Balance".
    expect(invoiceLabel(make({ seriesId: 'ser1', bookingId: null, isDeposit: false }))).toBe('Series invoice');
    expect(invoiceLabel(make({ seriesId: 'ser1', bookingId: null, isDeposit: true }))).toBe('Series invoice');
  });

  it('labels a booking deposit invoice "Deposit"', () => {
    expect(invoiceLabel(make({ isDeposit: true }))).toBe('Deposit');
  });

  it('labels a booking balance invoice "Balance"', () => {
    expect(invoiceLabel(make({ isDeposit: false }))).toBe('Balance');
  });
});

describe('isInvoiceOverdue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-01T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('is overdue when SENT and past its due date', () => {
    expect(isInvoiceOverdue(make({ status: 'SENT', dueDate: '2030-05-01' }))).toBe(true);
  });

  it('is not overdue when SENT but the due date is in the future', () => {
    expect(isInvoiceOverdue(make({ status: 'SENT', dueDate: '2030-07-01' }))).toBe(false);
  });

  it('is not overdue when SENT with no due date', () => {
    expect(isInvoiceOverdue(make({ status: 'SENT', dueDate: null }))).toBe(false);
  });

  it('is not overdue when ISSUED past its due date (overdue only applies to SENT)', () => {
    expect(isInvoiceOverdue(make({ status: 'ISSUED', dueDate: '2030-05-01' }))).toBe(false);
  });
});

describe('depositAmount / balanceAmount', () => {
  it('rounds the deposit to pence', () => {
    expect(depositAmount(1000, 25)).toBe(250);
    expect(depositAmount(333.33, 33)).toBe(110); // 109.9989 → 110.00
  });

  it('rounds the balance to pence and complements the deposit', () => {
    expect(balanceAmount(1000, 25)).toBe(750);
    expect(depositAmount(1000, 25) + balanceAmount(1000, 25)).toBe(1000);
  });
});

describe('coverTemplateFor', () => {
  it('uses the deposit cover for a deposit invoice', () => {
    expect(coverTemplateFor(make({ isDeposit: true }))).toBe('deposit_invoice_cover');
  });

  it('uses the balance cover for a balance invoice', () => {
    expect(coverTemplateFor(make({ isDeposit: false }))).toBe('balance_invoice_cover');
  });

  it('uses the balance cover for a series invoice (isDeposit false)', () => {
    expect(coverTemplateFor(make({ seriesId: 'ser1', bookingId: null, isDeposit: false }))).toBe('balance_invoice_cover');
  });
});

describe('activeInvoiceOf', () => {
  const deposit = make({ id: 'd', isDeposit: true, status: 'ISSUED' });
  const balance = make({ id: 'b', isDeposit: false, status: 'SENT' });
  const voidedDeposit = make({ id: 'vd', isDeposit: true, status: 'VOID' });

  it('finds the non-VOID deposit', () => {
    expect(activeInvoiceOf(true, [voidedDeposit, deposit, balance])?.id).toBe('d');
  });

  it('finds the non-VOID balance', () => {
    expect(activeInvoiceOf(false, [deposit, balance])?.id).toBe('b');
  });

  it('ignores VOID invoices', () => {
    expect(activeInvoiceOf(true, [voidedDeposit])).toBeUndefined();
  });
});

describe('sentInvoiceOf', () => {
  const sentDeposit = make({ id: 'sd', isDeposit: true, status: 'SENT' });
  const issuedDeposit = make({ id: 'id', isDeposit: true, status: 'ISSUED' });

  it('finds only a SENT invoice of the kind', () => {
    expect(sentInvoiceOf(true, [issuedDeposit, sentDeposit])?.id).toBe('sd');
  });

  it('returns undefined when the kind is not SENT', () => {
    expect(sentInvoiceOf(true, [issuedDeposit])).toBeUndefined();
  });
});

describe('hasAnyDepositInvoice (#756)', () => {
  it('is true when a deposit invoice exists', () => {
    expect(hasAnyDepositInvoice([make({ isDeposit: true })])).toBe(true);
  });

  it('is false when only a balance invoice exists', () => {
    expect(hasAnyDepositInvoice([make({ isDeposit: false })])).toBe(false);
  });

  it('is false for an empty list', () => {
    expect(hasAnyDepositInvoice([])).toBe(false);
  });

  // Void-inclusive on purpose: it must match shouldHideTemplate exactly, so the contract-send
  // shortcut can never pre-select a template the picker hides. A void-only deposit → template
  // shown → shortcut may pre-select it (both agree).
  it('is true for a VOID-only deposit invoice (matches shouldHideTemplate)', () => {
    expect(hasAnyDepositInvoice([make({ isDeposit: true, status: 'VOID' })])).toBe(true);
  });
});

describe('contractCoverTemplateFor (#756) — the shortcut both layouts use', () => {
  it('offers the combined email when a deposit invoice exists', () => {
    expect(contractCoverTemplateFor([make({ isDeposit: true })])).toBe('contract_and_deposit_cover');
  });

  it('offers the plain contract cover when no deposit invoice exists', () => {
    expect(contractCoverTemplateFor([make({ isDeposit: false })])).toBe('contract_cover');
    expect(contractCoverTemplateFor([])).toBe('contract_cover');
  });

  it('offers the combined email even for a VOID-only deposit (never pre-selects a hidden template)', () => {
    expect(contractCoverTemplateFor([make({ isDeposit: true, status: 'VOID' })])).toBe('contract_and_deposit_cover');
  });
});

describe('isDepositPercentageHintEligible (#758)', () => {
  it('is eligible when the fee is positive and no default percentage is set', () => {
    expect(isDepositPercentageHintEligible('1500.00', { depositPercentage: null })).toBe(true);
  });

  it('is not eligible when a default percentage exists', () => {
    expect(isDepositPercentageHintEligible('1500.00', { depositPercentage: 30 })).toBe(false);
  });

  it('is not eligible for a null, blank, or zero fee (a different gap)', () => {
    expect(isDepositPercentageHintEligible(null, { depositPercentage: null })).toBe(false);
    expect(isDepositPercentageHintEligible('', { depositPercentage: null })).toBe(false);
    expect(isDepositPercentageHintEligible('0', { depositPercentage: null })).toBe(false);
    expect(isDepositPercentageHintEligible('0.00', { depositPercentage: null })).toBe(false);
  });

  it('is not eligible until the profile is known (never flashes on load)', () => {
    expect(isDepositPercentageHintEligible('1500.00', undefined)).toBe(false);
    expect(isDepositPercentageHintEligible('1500.00', null)).toBe(false);
  });
});
