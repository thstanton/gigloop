import { describe, it, expect } from 'vitest';
import {
  getInvoiceIdForTemplate,
  shouldHideTemplate,
  formatMissingVariables,
  getAttachmentState,
  isComposableEmailTemplate,
  findPreselectTemplateId,
  computeInvoiceDateDefaults,
  buildRenderUrl,
  buildSendRequest,
  canRenderEmail,
  canSendEmail,
} from './composeHelpers';
import type { Invoice, Template } from '@/types/api';

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
    // VOID deposit satisfies shouldHideTemplate (invoice exists) but getInvoiceIdForTemplate filters it out
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

  it('excludes document-only built-in types', () => {
    expect(isComposableEmailTemplate(makeTemplate({ builtInType: 'contract' }), false)).toBe(false);
  });

  it('hides music_form_invite unless the booking has a music form configured', () => {
    const t = makeTemplate({ builtInType: 'music_form_invite' });
    expect(isComposableEmailTemplate(t, false)).toBe(false);
    expect(isComposableEmailTemplate(t, true)).toBe(true);
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
  const base = {
    bookingId: 'b1',
    invoiceId: undefined as string | undefined,
    isInvoiceEmail: false,
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
    const { url } = buildSendRequest({ ...base, isInvoiceEmail: true, invoiceId: 'inv-1' });
    expect(url).toBe('/bookings/b1/invoices/inv-1/send');
  });

  it('includes issue/due dates for draft invoices only', () => {
    const { payload } = buildSendRequest({
      ...base,
      isInvoiceEmail: true,
      invoiceId: 'inv-1',
      showDateFields: true,
      formIssueDate: '2030-01-01',
      formDueDate: '2030-02-01',
    });
    expect(payload).toMatchObject({ issueDate: '2030-01-01', dueDate: '2030-02-01' });
  });

  it('omits dates for issued invoices', () => {
    const { payload } = buildSendRequest({ ...base, isInvoiceEmail: true, invoiceId: 'inv-1' });
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
