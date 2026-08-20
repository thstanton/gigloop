import { describe, it, expect } from 'vitest';
import {
  getInvoiceIdForTemplate,
  formatMissingVariables,
  getAttachmentState,
  isComposableEmailTemplate,
  findPreselectTemplateId,
  computeInvoiceDateDefaults,
  buildRenderUrl,
  buildSendRequest,
  canRenderEmail,
  canSendEmail,
  shouldSuggestCreatingContract,
  shouldSuggestCreatingDepositInvoice,
  EMAIL_TEMPLATE_SCOPE,
  type SeriesComposeTarget,
} from './composeHelpers';
import { BUILT_IN_EMAIL_TYPES, BUILT_IN_DOCUMENT_TYPES } from '@/features/templates/templateMeta';
import type { ChecklistItem, Contact, Contract, Invoice, Template } from '@/types/api';

const goal = (key: string): ChecklistItem => ({ key } as unknown as ChecklistItem);
const contract = (status: Contract['status']): Contract => ({ status } as unknown as Contract);

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

// A series invoice as the wire actually carries one (ADR-0029): seriesId set, bookingId null —
// so it can never appear in a booking's invoice list, which is the whole point of the target.
const seriesInvoice = makeInvoice({
  id: 'ser-1',
  bookingId: null,
  seriesId: 's1',
  status: 'ISSUED',
  invoiceNumber: 'INV-0007',
});

const seriesTarget: SeriesComposeTarget = {
  seriesId: 's1',
  seriesLabel: 'Thursday residency',
  invoice: seriesInvoice,
  // The series customer, deliberately not the member booking's.
  recipient: { id: 'c-series', name: 'Hotel Group', email: 'bookings@hotel.test' } as unknown as Contact,
};

const contractGoal = goal('get_contract_signed');
const depositGoal = goal('get_deposit_paid');

// ─── shouldSuggestCreatingContract (#757 Hint A) ──────────────────────────────

describe('shouldSuggestCreatingContract', () => {
  it('suggests when composing a deposit invoice, no contract, contract goal present', () => {
    expect(shouldSuggestCreatingContract('deposit_invoice_cover', null, [contractGoal])).toBe(true);
  });

  it('treats a VOID contract as no contract (matches ContractCard)', () => {
    expect(shouldSuggestCreatingContract('deposit_invoice_cover', contract('VOID'), [contractGoal])).toBe(true);
  });

  it('does not suggest when a live contract exists', () => {
    expect(shouldSuggestCreatingContract('deposit_invoice_cover', contract('DRAFT'), [contractGoal])).toBe(false);
  });

  it('does not suggest when the contract goal is absent from the checklist', () => {
    expect(shouldSuggestCreatingContract('deposit_invoice_cover', null, [])).toBe(false);
  });

  it('does not suggest for a non-deposit template', () => {
    expect(shouldSuggestCreatingContract('contract_cover', null, [contractGoal])).toBe(false);
    expect(shouldSuggestCreatingContract(null, null, [contractGoal])).toBe(false);
  });

  it('accepts the legacy flat goal key', () => {
    expect(shouldSuggestCreatingContract('deposit_invoice_cover', null, [goal('contract_signed')])).toBe(true);
  });
});

// ─── shouldSuggestCreatingDepositInvoice (#757 Hint B) ────────────────────────

describe('shouldSuggestCreatingDepositInvoice', () => {
  const deposit = makeInvoice({ isDeposit: true, status: 'ISSUED' });
  const voidDeposit = makeInvoice({ isDeposit: true, status: 'VOID' });

  it('suggests when composing a contract, no usable deposit, deposit goal present', () => {
    expect(shouldSuggestCreatingDepositInvoice('contract_cover', [], [depositGoal])).toBe(true);
  });

  it('suggests when only a VOID deposit exists (it can be re-created)', () => {
    expect(shouldSuggestCreatingDepositInvoice('contract_cover', [voidDeposit], [depositGoal])).toBe(true);
  });

  it('does not suggest when a usable deposit invoice exists', () => {
    expect(shouldSuggestCreatingDepositInvoice('contract_cover', [deposit], [depositGoal])).toBe(false);
  });

  it('does not suggest when the deposit goal is absent', () => {
    expect(shouldSuggestCreatingDepositInvoice('contract_cover', [], [])).toBe(false);
  });

  it('does not suggest for a non-contract template', () => {
    expect(shouldSuggestCreatingDepositInvoice('contract_and_deposit_cover', [], [depositGoal])).toBe(false);
    expect(shouldSuggestCreatingDepositInvoice(null, [], [depositGoal])).toBe(false);
  });

  it('accepts the legacy flat goal key', () => {
    expect(shouldSuggestCreatingDepositInvoice('contract_cover', [], [goal('deposit_received')])).toBe(true);
  });
});

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

// ─── getAttachmentState ───────────────────────────────────────────────────────

describe('getAttachmentState', () => {
  const issuedDeposit = makeInvoice({ id: 'dep-1', isDeposit: true, status: 'ISSUED', invoiceNumber: 'INV-2030-001' });
  const draftDeposit = makeInvoice({ id: 'dep-2', isDeposit: true, status: 'DRAFT', invoiceNumber: null });
  const voidDeposit = makeInvoice({ id: 'dep-3', isDeposit: true, status: 'VOID', invoiceNumber: 'INV-OLD-001' });
  const issuedBalance = makeInvoice({ id: 'bal-1', isDeposit: false, status: 'ISSUED', invoiceNumber: 'INV-2030-002' });
  const draftBalance = makeInvoice({ id: 'bal-2', isDeposit: false, status: 'DRAFT', invoiceNumber: null });

  it('returns null for non-attachment template types', () => {
    const nonAttachmentTypes = ['quote', 'confirmation', 'contract_cover', 'contract_received',
      'deposit_received', 'music_form_invite', 'thank_you'] as const;
    for (const type of nonAttachmentTypes) {
      expect(getAttachmentState(type, [issuedDeposit, issuedBalance])).toBeNull();
    }
  });

  it('returns null for null type', () => {
    expect(getAttachmentState(null, [issuedDeposit])).toBeNull();
  });

  it('returns present with invoice number filename for an ISSUED deposit invoice', () => {
    expect(getAttachmentState('deposit_invoice_cover', [issuedDeposit])).toEqual({
      kind: 'present',
      filename: 'Invoice INV-2030-001.pdf',
    });
  });

  it('returns present with generic label for a DRAFT deposit invoice (no number yet)', () => {
    expect(getAttachmentState('deposit_invoice_cover', [draftDeposit])).toEqual({
      kind: 'present',
      filename: 'Deposit invoice PDF',
    });
  });

  it('returns present with invoice number filename for an ISSUED balance invoice', () => {
    expect(getAttachmentState('balance_invoice_cover', [issuedBalance])).toEqual({
      kind: 'present',
      filename: 'Invoice INV-2030-002.pdf',
    });
  });

  it('returns present with generic label for a DRAFT balance invoice (no number yet)', () => {
    expect(getAttachmentState('balance_invoice_cover', [draftBalance])).toEqual({
      kind: 'present',
      filename: 'Balance invoice PDF',
    });
  });

  it('returns present for contract_and_deposit_cover using the deposit invoice', () => {
    expect(getAttachmentState('contract_and_deposit_cover', [issuedDeposit, issuedBalance])).toEqual({
      kind: 'present',
      filename: 'Invoice INV-2030-001.pdf',
    });
  });

  it('returns deposit warning when only a VOID deposit invoice exists', () => {
    // getInvoiceIdForTemplate filters VOID invoices out via activeInvoiceOf, so a VOID-only
    // deposit resolves to no id here even though the template is still offered (offer-then-warn).
    expect(getAttachmentState('deposit_invoice_cover', [voidDeposit])).toEqual({
      kind: 'warning',
      message: 'No deposit invoice to attach',
    });
  });

  it('returns deposit warning when no deposit invoice exists at all', () => {
    expect(getAttachmentState('deposit_invoice_cover', [])).toEqual({
      kind: 'warning',
      message: 'No deposit invoice to attach',
    });
  });

  it('returns balance warning for balance_invoice_cover when no balance invoice exists', () => {
    expect(getAttachmentState('balance_invoice_cover', [issuedDeposit])).toEqual({
      kind: 'warning',
      message: 'No balance invoice to attach',
    });
  });

  it('returns deposit warning for contract_and_deposit_cover when no deposit invoice exists', () => {
    expect(getAttachmentState('contract_and_deposit_cover', [issuedBalance])).toEqual({
      kind: 'warning',
      message: 'No deposit invoice to attach',
    });
  });
});

// ─── Offer-then-warn (#928) ────────────────────────────────────────────────
//
// The compose picker's only visibility predicate (isComposableEmailTemplate) never consults
// invoice presence — a booking missing the relevant invoice still gets offered the template, and
// getAttachmentState warns instead of the template disappearing. This was previously implied by
// the now-deleted shouldHideTemplate's own (unwired) spec; pinned directly against the live
// predicates here so a future "hide it" change can't silently reintroduce a hide policy.

describe('offer-then-warn: a missing invoice never hides the template', () => {
  it('still offers deposit_invoice_cover with no deposit invoice, and warns on attachment', () => {
    expect(isComposableEmailTemplate(makeTemplate({ builtInType: 'deposit_invoice_cover' }), false)).toBe(true);
    expect(getAttachmentState('deposit_invoice_cover', [])).toEqual({
      kind: 'warning',
      message: 'No deposit invoice to attach',
    });
  });

  it('still offers contract_and_deposit_cover with no deposit invoice, and warns on attachment', () => {
    expect(isComposableEmailTemplate(makeTemplate({ builtInType: 'contract_and_deposit_cover' }), false)).toBe(true);
    expect(getAttachmentState('contract_and_deposit_cover', [])).toEqual({
      kind: 'warning',
      message: 'No deposit invoice to attach',
    });
  });

  it('still offers balance_invoice_cover with no balance invoice, and warns on attachment', () => {
    expect(isComposableEmailTemplate(makeTemplate({ builtInType: 'balance_invoice_cover' }), false)).toBe(true);
    expect(getAttachmentState('balance_invoice_cover', [])).toEqual({
      kind: 'warning',
      message: 'No balance invoice to attach',
    });
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

// ─── isComposableEmailTemplate ──────────────────────────────────────────────

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'tpl-1',
    name: 'A template',
    builtInType: 'confirmation',
    content: { type: 'doc', content: [] },
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  } as unknown as Template;
}

describe('isComposableEmailTemplate', () => {
  it('includes built-in email templates', () => {
    expect(isComposableEmailTemplate(makeTemplate({ builtInType: 'confirmation' }), false)).toBe(true);
  });

  it('excludes templates with no built-in type', () => {
    expect(isComposableEmailTemplate(makeTemplate({ builtInType: null }), false)).toBe(false);
  });

  it('excludes document-only built-in types, in booking mode and series mode alike', () => {
    const t = makeTemplate({ builtInType: 'contract' });
    expect(isComposableEmailTemplate(t, false)).toBe(false);
    expect(isComposableEmailTemplate(t, false, seriesTarget)).toBe(false);
  });

  it('hides music_form_invite unless the booking has a music form configured', () => {
    const t = makeTemplate({ builtInType: 'music_form_invite' });
    expect(isComposableEmailTemplate(t, false)).toBe(false);
    expect(isComposableEmailTemplate(t, true)).toBe(true);
  });
});

// ─── EMAIL_TEMPLATE_SCOPE guards against #846 ──────────────────────────────
//
// EMAIL_TEMPLATE_SCOPE is a compile-time completeness check (a Record over every
// BuiltInTemplateType member) — a new built-in type can't go undeclared — and
// isComposableEmailTemplate reads it directly, so a wrongly-declared row is a real behaviour
// change, not just a mismatched comment. These tests pin that behaviour per entry, the way the
// dead shouldHideTemplate's own spec never pinned anything the picker actually ran (#928).

describe('EMAIL_TEMPLATE_SCOPE', () => {
  it('every built-in email type has a booking or series scope declared', () => {
    for (const type of BUILT_IN_EMAIL_TYPES) {
      expect(['booking', 'series']).toContain(EMAIL_TEMPLATE_SCOPE[type]);
    }
  });

  it('isComposableEmailTemplate composes exactly the booking-scoped types in booking mode', () => {
    for (const type of BUILT_IN_EMAIL_TYPES) {
      const t = makeTemplate({ builtInType: type });
      expect(isComposableEmailTemplate(t, true)).toBe(EMAIL_TEMPLATE_SCOPE[type] === 'booking');
    }
  });

  it('isComposableEmailTemplate composes exactly the series-scoped types in series mode', () => {
    for (const type of BUILT_IN_EMAIL_TYPES) {
      const t = makeTemplate({ builtInType: type });
      expect(isComposableEmailTemplate(t, true, seriesTarget)).toBe(EMAIL_TEMPLATE_SCOPE[type] === 'series');
    }
  });

  it('marks exactly the built-in document types as document-scoped', () => {
    for (const type of BUILT_IN_DOCUMENT_TYPES) {
      expect(EMAIL_TEMPLATE_SCOPE[type]).toBe('document');
    }
    for (const type of BUILT_IN_EMAIL_TYPES) {
      expect(EMAIL_TEMPLATE_SCOPE[type]).not.toBe('document');
    }
  });
});

// ─── findPreselectTemplateId ────────────────────────────────────────────────

describe('findPreselectTemplateId', () => {
  const templates = [
    makeTemplate({ id: 't-conf', builtInType: 'confirmation' }),
    makeTemplate({ id: 't-quote', builtInType: 'quote' }),
  ];

  it('returns the id of the template matching the requested type', () => {
    expect(findPreselectTemplateId(templates, 'quote')).toBe('t-quote');
  });

  it('returns null when no template matches', () => {
    expect(findPreselectTemplateId(templates, 'thank_you')).toBeNull();
  });

  it('returns null when no type is requested', () => {
    expect(findPreselectTemplateId(templates, undefined)).toBeNull();
  });
});

// ─── computeInvoiceDateDefaults ─────────────────────────────────────────────

describe('computeInvoiceDateDefaults', () => {
  it('defaults the issue date to today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(computeInvoiceDateDefaults(30).issueDate).toBe(today);
  });

  it('sets the due date to issue date + payment terms', () => {
    const { issueDate, dueDate } = computeInvoiceDateDefaults(30);
    const expected = new Date(issueDate);
    expected.setDate(expected.getDate() + 30);
    expect(dueDate).toBe(expected.toISOString().slice(0, 10));
  });

  it('leaves the due date blank when no terms are configured', () => {
    expect(computeInvoiceDateDefaults(undefined).dueDate).toBe('');
    expect(computeInvoiceDateDefaults(0).dueDate).toBe('');
  });
});

// ─── buildRenderUrl ─────────────────────────────────────────────────────────

describe('buildRenderUrl', () => {
  const base = {
    bookingId: 'b1',
    templateId: 'tpl-1',
    invoiceId: undefined,
    issueDate: '',
    dueDate: '',
    showDateFields: false,
  };

  it('returns an empty string when no template is selected', () => {
    expect(buildRenderUrl({ ...base, templateId: '' })).toBe('');
  });

  it('builds the base render url for a plain template', () => {
    expect(buildRenderUrl(base)).toBe('/bookings/b1/communications/render?templateId=tpl-1');
  });

  it('appends the invoice id when present', () => {
    expect(buildRenderUrl({ ...base, invoiceId: 'inv-1' })).toBe(
      '/bookings/b1/communications/render?templateId=tpl-1&invoiceId=inv-1',
    );
  });

  it('appends issue/due dates only when date fields are shown', () => {
    expect(buildRenderUrl({ ...base, issueDate: '2030-01-01', dueDate: '2030-02-01' })).toBe(
      '/bookings/b1/communications/render?templateId=tpl-1',
    );
    expect(
      buildRenderUrl({ ...base, issueDate: '2030-01-01', dueDate: '2030-02-01', showDateFields: true }),
    ).toBe('/bookings/b1/communications/render?templateId=tpl-1&issueDate=2030-01-01&dueDate=2030-02-01');
  });
});

// ─── buildSendRequest ───────────────────────────────────────────────────────

describe('buildSendRequest', () => {
  // A booking-owned invoice: the send URL is derived from its own FKs (invoiceOwnerRoute), not
  // from the bookingId the sheet was mounted with.
  const bookingSendInvoice = makeInvoice({ id: 'inv-1', bookingId: 'b1', seriesId: null });

  const base = {
    bookingId: 'b1',
    invoice: undefined as Invoice | undefined,
    showDateFields: false,
    formIssueDate: '',
    formDueDate: '',
    to: 'sophie@example.com',
    contactId: 'c1',
    subject: 'Hi',
    body: '<p>Hello</p>',
    templateId: 'tpl-1',
  };

  it('routes non-invoice emails to the communications endpoint', () => {
    const { url, payload } = buildSendRequest(base);
    expect(url).toBe('/bookings/b1/communications/send');
    expect(payload).toEqual({
      to: 'sophie@example.com',
      contactId: 'c1',
      subject: 'Hi',
      body: '<p>Hello</p>',
      templateId: 'tpl-1',
    });
  });

  it('routes invoice emails to the invoice-send endpoint', () => {
    const { url } = buildSendRequest({ ...base, invoice: bookingSendInvoice });
    expect(url).toBe('/bookings/b1/invoices/inv-1/send');
  });

  it('includes issue/due dates for draft invoices only', () => {
    const { payload } = buildSendRequest({
      ...base,
      invoice: bookingSendInvoice,
      showDateFields: true,
      formIssueDate: '2030-01-01',
      formDueDate: '2030-02-01',
    });
    expect(payload).toMatchObject({ issueDate: '2030-01-01', dueDate: '2030-02-01' });
  });

  it('omits dates for issued invoices', () => {
    const { payload } = buildSendRequest({ ...base, invoice: bookingSendInvoice });
    expect(payload).not.toHaveProperty('issueDate');
  });

  it('omits the templateId when none is selected', () => {
    const { payload } = buildSendRequest({ ...base, templateId: '' });
    expect(payload).not.toHaveProperty('templateId');
  });
});

// ─── canRenderEmail / canSendEmail ──────────────────────────────────────────

describe('canRenderEmail', () => {
  const ready = {
    isLoaded: true,
    open: true,
    hasTemplate: true,
    renderUrl: '/render',
    showDateFields: false,
    formIssueDate: '',
  };

  it('is true when loaded, open, has a template and url', () => {
    expect(canRenderEmail(ready)).toBe(true);
  });

  it('is false until auth has loaded, the sheet is open, and a template+url exist', () => {
    expect(canRenderEmail({ ...ready, isLoaded: false })).toBe(false);
    expect(canRenderEmail({ ...ready, open: false })).toBe(false);
    expect(canRenderEmail({ ...ready, hasTemplate: false })).toBe(false);
    expect(canRenderEmail({ ...ready, renderUrl: '' })).toBe(false);
  });

  it('requires an issue date when date fields are shown', () => {
    expect(canRenderEmail({ ...ready, showDateFields: true, formIssueDate: '' })).toBe(false);
    expect(canRenderEmail({ ...ready, showDateFields: true, formIssueDate: '2030-01-01' })).toBe(true);
  });
});

describe('canSendEmail', () => {
  const ready = {
    hasEmail: true,
    hasTemplate: true,
    hasSubject: true,
    rendering: false,
    sending: false,
    showDateFields: false,
    formIssueDate: '',
  };

  it('is true when all preconditions are met', () => {
    expect(canSendEmail(ready)).toBe(true);
  });

  it('is false without an email, template or subject, or while busy', () => {
    expect(canSendEmail({ ...ready, hasEmail: false })).toBe(false);
    expect(canSendEmail({ ...ready, hasTemplate: false })).toBe(false);
    expect(canSendEmail({ ...ready, hasSubject: false })).toBe(false);
    expect(canSendEmail({ ...ready, rendering: true })).toBe(false);
    expect(canSendEmail({ ...ready, sending: true })).toBe(false);
  });

  it('is false when the music-form invite is selected but the form is not published (#631)', () => {
    // All other preconditions met — the publish gate alone blocks Send.
    expect(canSendEmail({ ...ready, musicInviteBlocked: true })).toBe(false);
  });

  it('requires an issue date when date fields are shown', () => {
    expect(canSendEmail({ ...ready, showDateFields: true, formIssueDate: '' })).toBe(false);
    expect(canSendEmail({ ...ready, showDateFields: true, formIssueDate: '2030-01-01' })).toBe(true);
  });
});

// ─── Series mode (#847) ─────────────────────────────────────────────────────
//
// The compose surface's owner-awareness, gathered in one place: which templates are offered,
// which invoice is attached, and where render and send post. The booking's invoice list is
// deliberately non-empty in most cases below — a series invoice must never be found in it, and
// the booking's own invoices must never be mistaken for it.

describe('series compose target', () => {
  const bookingInvoices = [depositInvoice, balanceInvoice];

  describe('getInvoiceIdForTemplate', () => {
    it('resolves the series cover to the target invoice, not anything in the booking list', () => {
      expect(getInvoiceIdForTemplate('series_invoice_cover', bookingInvoices, seriesTarget)).toBe('ser-1');
    });

    it('resolves to nothing without a target — a series invoice is never in a booking list', () => {
      expect(getInvoiceIdForTemplate('series_invoice_cover', bookingInvoices)).toBeUndefined();
    });

    it('leaves the booking covers reading the booking list even in series mode', () => {
      expect(getInvoiceIdForTemplate('deposit_invoice_cover', bookingInvoices, seriesTarget)).toBe('dep-1');
      expect(getInvoiceIdForTemplate('balance_invoice_cover', bookingInvoices, seriesTarget)).toBe('bal-1');
    });
  });

  describe('getAttachmentState', () => {
    it('names the attachment from the series invoice number', () => {
      expect(getAttachmentState('series_invoice_cover', [], seriesTarget)).toEqual({
        kind: 'present',
        filename: 'Invoice INV-0007.pdf',
      });
    });

    it('falls back to a series-shaped label when the invoice has no number yet', () => {
      const draft = { ...seriesTarget, invoice: makeInvoice({ id: 'ser-1', bookingId: null, seriesId: 's1' }) };
      expect(getAttachmentState('series_invoice_cover', [], draft)).toEqual({
        kind: 'present',
        filename: 'Series invoice PDF',
      });
    });

    it('warns in series terms when there is no series invoice to attach', () => {
      expect(getAttachmentState('series_invoice_cover', bookingInvoices)).toEqual({
        kind: 'warning',
        message: 'No series invoice to attach',
      });
    });
  });

  describe('isComposableEmailTemplate', () => {
    const seriesCover = makeTemplate({ builtInType: 'series_invoice_cover' });

    it('offers only the series cover in series mode', () => {
      expect(isComposableEmailTemplate(seriesCover, false, seriesTarget)).toBe(true);
      expect(isComposableEmailTemplate(makeTemplate({ builtInType: 'balance_invoice_cover' }), false, seriesTarget)).toBe(false);
      expect(isComposableEmailTemplate(makeTemplate({ builtInType: 'confirmation' }), true, seriesTarget)).toBe(false);
    });

    // The regression #846 could not prevent: a built-in email type is offered on every booking
    // unless something excludes it, and this is the predicate the picker actually calls.
    it('never offers the series cover on an ordinary booking', () => {
      expect(isComposableEmailTemplate(seriesCover, false)).toBe(false);
      expect(isComposableEmailTemplate(seriesCover, true)).toBe(false);
    });
  });

  describe('buildRenderUrl', () => {
    const base = {
      bookingId: 'b1',
      templateId: 'tpl-1',
      invoiceId: 'ser-1',
      issueDate: '',
      dueDate: '',
      showDateFields: false,
    };

    it('renders against the series, not the member booking it was opened from', () => {
      expect(buildRenderUrl({ ...base, series: seriesTarget })).toBe(
        '/series/s1/communications/render?templateId=tpl-1&invoiceId=ser-1',
      );
    });
  });

  describe('buildSendRequest', () => {
    const base = {
      // The member booking the sheet is mounted on — deliberately present, and deliberately not
      // what the URL is built from.
      bookingId: 'b1',
      showDateFields: false,
      formIssueDate: '',
      formDueDate: '',
      to: 'bookings@hotel.test',
      contactId: 'c-series',
      subject: 'Your invoice',
      body: '<p>Hi</p>',
      templateId: 'tpl-1',
    };

    it('posts to the series send route, derived from the invoice rather than the host booking', () => {
      expect(buildSendRequest({ ...base, invoice: seriesInvoice }).url).toBe('/series/s1/invoices/ser-1/send');
    });

    it('still posts a booking-owned invoice to the booking route from the same sheet', () => {
      const bookingInvoice = makeInvoice({ id: 'bal-9', bookingId: 'b1', seriesId: null });
      expect(buildSendRequest({ ...base, invoice: bookingInvoice }).url).toBe('/bookings/b1/invoices/bal-9/send');
    });
  });
});
