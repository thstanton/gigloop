import { isDeletable, isEditable, isIssuable, isPayable, isSendable, isVoidable } from './invoice-transition-rules';
import type { InvoiceForRules } from './invoice-transition-rules';

const draft: InvoiceForRules = { status: 'DRAFT', invoiceNumber: null };
const numberedDraft: InvoiceForRules = { status: 'DRAFT', invoiceNumber: 'INV-2026-001' };
const issued: InvoiceForRules = { status: 'ISSUED', invoiceNumber: 'INV-2026-001' };
const sent: InvoiceForRules = { status: 'SENT', invoiceNumber: 'INV-2026-001' };
const paid: InvoiceForRules = { status: 'PAID', invoiceNumber: 'INV-2026-001' };
const voided: InvoiceForRules = { status: 'VOID', invoiceNumber: 'INV-2026-001' };
const voidedUnnumbered: InvoiceForRules = { status: 'VOID', invoiceNumber: null };

describe('isIssuable', () => {
  it('is true for DRAFT', () => expect(isIssuable(draft)).toBe(true));
  it('is false for ISSUED', () => expect(isIssuable(issued)).toBe(false));
  it('is false for SENT', () => expect(isIssuable(sent)).toBe(false));
  it('is false for PAID', () => expect(isIssuable(paid)).toBe(false));
  it('is false for VOID', () => expect(isIssuable(voided)).toBe(false));
});

describe('isSendable', () => {
  it('is true for ISSUED', () => expect(isSendable(issued)).toBe(true));
  it('is false for DRAFT', () => expect(isSendable(draft)).toBe(false));
  it('is false for SENT', () => expect(isSendable(sent)).toBe(false));
  it('is false for PAID', () => expect(isSendable(paid)).toBe(false));
  it('is false for VOID', () => expect(isSendable(voided)).toBe(false));
});

describe('isVoidable', () => {
  it('is false for unnumbered DRAFT (delete instead)', () => expect(isVoidable(draft)).toBe(false));
  it('is false for numbered DRAFT (delete instead — consistent with lifecycle)', () => expect(isVoidable(numberedDraft)).toBe(false));
  it('is true for ISSUED (has a number)', () => expect(isVoidable(issued)).toBe(true));
  it('is true for SENT', () => expect(isVoidable(sent)).toBe(true));
  it('is true for PAID', () => expect(isVoidable(paid)).toBe(true));
  it('is false for VOID (already voided)', () => expect(isVoidable(voided)).toBe(false));
  it('is false for unnumbered VOID', () => expect(isVoidable(voidedUnnumbered)).toBe(false));
});

describe('isPayable', () => {
  it('is true for SENT', () => expect(isPayable(sent)).toBe(true));
  it('is false for DRAFT', () => expect(isPayable(draft)).toBe(false));
  it('is false for ISSUED', () => expect(isPayable(issued)).toBe(false));
  it('is false for PAID', () => expect(isPayable(paid)).toBe(false));
  it('is false for VOID', () => expect(isPayable(voided)).toBe(false));
});

describe('isEditable', () => {
  it('is true for DRAFT', () => expect(isEditable(draft)).toBe(true));
  it('is false for ISSUED', () => expect(isEditable(issued)).toBe(false));
  it('is false for SENT', () => expect(isEditable(sent)).toBe(false));
  it('is false for PAID', () => expect(isEditable(paid)).toBe(false));
  it('is false for VOID', () => expect(isEditable(voided)).toBe(false));
});

describe('isDeletable', () => {
  it('is true for DRAFT', () => expect(isDeletable(draft)).toBe(true));
  it('is false for ISSUED (must void instead)', () => expect(isDeletable(issued)).toBe(false));
  it('is false for SENT', () => expect(isDeletable(sent)).toBe(false));
  it('is false for PAID', () => expect(isDeletable(paid)).toBe(false));
  it('is false for VOID', () => expect(isDeletable(voided)).toBe(false));
});
