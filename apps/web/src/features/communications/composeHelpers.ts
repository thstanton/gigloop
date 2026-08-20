import type { BuiltInTemplateType, ChecklistItem, Contact, Contract, Invoice, Template } from '@/types/api';
import { VAR_LABELS } from '@/features/templates/templateMeta';
import { activeInvoiceOf } from '@/lib/invoiceDerivations';
import { invoiceOwnerRoute } from '@/lib/invoiceActionRouting';

/**
 * The series invoice a compose sheet was opened to send (#847) — the sheet's *owner* for that
 * open. Present ⇒ series mode: the sheet composes `series_invoice_cover` against the series,
 * renders with series context, and posts to the series send route.
 *
 * The invoice is handed in already resolved. It is never searched for in the member booking's
 * invoice list — that list is empty for a series member, which is what left the compose sheet
 * with a hidden template and no attachment (the same defect class as #844).
 */
export interface SeriesComposeTarget {
  seriesId: string;
  seriesLabel: string;
  /**
   * The series' single active invoice. `SeriesService.createInvoice` rejects a second non-VOID
   * invoice with a 409, so `GET /series/:id/invoices/current` *is* the acted-on invoice — there
   * is no list to pick the wrong row from.
   */
  invoice: Invoice;
  /**
   * Who the invoice is billed to. `createSeriesInvoice` seeds `billToContactId` from
   * `series.customerId`, so this is the *series* customer — which may differ from any member
   * booking's own customer (CONTEXT.md → BookingSeries → Membership).
   */
  recipient: Contact;
}

// A goal is identified by its post-ADR-0057 key or its legacy flat key — the same dual-key check
// the API uses (bookings.service.ts). `checklist` is goals-only; step keys never appear here.
const CONTRACT_GOAL_KEYS = ['get_contract_signed', 'contract_signed'];
const DEPOSIT_GOAL_KEYS = ['get_deposit_paid', 'deposit_received'];

function hasGoal(checklist: ChecklistItem[], keys: string[]): boolean {
  return checklist.some((item) => item.key != null && keys.includes(item.key));
}

/**
 * #757 Hint A: the musician is composing a deposit-invoice email but there is no usable contract,
 * and the contract goal is on this booking's checklist. Nudge them to create the contract so both
 * can go in one email. Gated on the goal so someone who has disabled contracts never sees it.
 * "No usable contract" matches ContractCard: absent, or VOID (activeContract is not void-filtered).
 */
export function shouldSuggestCreatingContract(
  selectedType: BuiltInTemplateType | null,
  activeContract: Contract | null,
  checklist: ChecklistItem[],
): boolean {
  const noContract = !activeContract || activeContract.status === 'VOID';
  return selectedType === 'deposit_invoice_cover' && noContract && hasGoal(checklist, CONTRACT_GOAL_KEYS);
}

/**
 * #757 Hint B: the musician is composing a contract email but there is no usable deposit invoice,
 * and the deposit goal is on this booking's checklist. Nudge them to create the deposit invoice so
 * both can go in one email. "No usable deposit" is the NON-void predicate (activeInvoiceOf) — a
 * void-only deposit can still be re-created — distinct from hasAnyDepositInvoice, which governs
 * which cover template the contract-send shortcut pre-selects, not which templates the picker offers.
 */
export function shouldSuggestCreatingDepositInvoice(
  selectedType: BuiltInTemplateType | null,
  invoices: Invoice[],
  checklist: ChecklistItem[],
): boolean {
  const noDeposit = !activeInvoiceOf(true, invoices);
  return selectedType === 'contract_cover' && noDeposit && hasGoal(checklist, DEPOSIT_GOAL_KEYS);
}

const ATTACHMENT_TEMPLATE_TYPES: BuiltInTemplateType[] = [
  'deposit_invoice_cover',
  'balance_invoice_cover',
  'contract_and_deposit_cover',
  'series_invoice_cover',
];

export type AttachmentState =
  | { kind: 'present'; filename: string }
  | { kind: 'warning'; message: string }
  | null;

/**
 * The invoice a template attaches. `invoices` is the *booking's* list; `series` is the resolved
 * series invoice when the sheet is in series mode. The series cover never consults the list — a
 * series invoice is not booking-scoped, so searching a booking's list for one is the bug (#844).
 */
export function getInvoiceIdForTemplate(
  type: BuiltInTemplateType | null,
  invoices: Invoice[],
  series?: SeriesComposeTarget,
): string | undefined {
  if (type === 'series_invoice_cover') return series?.invoice.id;
  if (type === 'deposit_invoice_cover' || type === 'contract_and_deposit_cover') {
    return activeInvoiceOf(true, invoices)?.id;
  }
  if (type === 'balance_invoice_cover') {
    return activeInvoiceOf(false, invoices)?.id;
  }
  return undefined;
}

function resolveAttachmentFilename(invoice: Invoice | undefined): string {
  if (invoice?.invoiceNumber) return `Invoice ${invoice.invoiceNumber}.pdf`;
  if (invoice?.seriesId) return 'Series invoice PDF';
  if (invoice?.isDeposit) return 'Deposit invoice PDF';
  return 'Balance invoice PDF';
}

const MISSING_ATTACHMENT_MESSAGES: Partial<Record<BuiltInTemplateType, string>> = {
  balance_invoice_cover: 'No balance invoice to attach',
  series_invoice_cover: 'No series invoice to attach',
};

export function getAttachmentState(
  type: BuiltInTemplateType | null,
  invoices: Invoice[],
  series?: SeriesComposeTarget,
): AttachmentState {
  if (!type || !ATTACHMENT_TEMPLATE_TYPES.includes(type)) return null;

  const invoiceId = getInvoiceIdForTemplate(type, invoices, series);
  if (!invoiceId) {
    return {
      kind: 'warning',
      message: MISSING_ATTACHMENT_MESSAGES[type] ?? 'No deposit invoice to attach',
    };
  }

  // The series invoice is not in the booking's list — resolve it from the target that carried it.
  const invoice =
    series && series.invoice.id === invoiceId
      ? series.invoice
      : invoices.find((i) => i.id === invoiceId);
  const filename = resolveAttachmentFilename(invoice);

  return { kind: 'present', filename };
}

export function formatMissingVariables(keys: string[]): string {
  const labels = keys.map((k) => VAR_LABELS[k] ?? k);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/**
 * #928: which sheet mode composes each built-in *email* type — the explicit decision #846 skipped
 * when `series_invoice_cover` was added to `BUILT_IN_EMAIL_TYPES` without excluding it from the
 * booking picker. Deliberately partial and keyed only on ownership: whether a type is an email type
 * at all is already declared exactly once, in `BUILT_IN_EMAIL_TYPES`/`BUILT_IN_DOCUMENT_TYPES`
 * (templateMeta.ts) — restating that split here would be the second hand-written list CLAUDE.md's
 * "one declaration per vocabulary" rule forbids. `composeHelpers.spec.ts` asserts every entry in
 * `BUILT_IN_EMAIL_TYPES` has a row here (the completeness this Partial type can't get from the
 * compiler), and {@link isComposableEmailTemplate} reads this table directly, so a wrongly-declared
 * row changes real behaviour and gets caught by the series-mode / booking-mode tests.
 */
export const EMAIL_TEMPLATE_OWNER: Partial<Record<BuiltInTemplateType, 'booking' | 'series'>> = {
  quote: 'booking',
  confirmation: 'booking',
  contract_cover: 'booking',
  contract_and_deposit_cover: 'booking',
  deposit_invoice_cover: 'booking',
  balance_invoice_cover: 'booking',
  series_invoice_cover: 'series',
  music_form_invite: 'booking',
  thank_you: 'booking',
  contract_received: 'booking',
  deposit_received: 'booking',
};

/**
 * A template is composable as an email when it is a built-in email type (music-form invites need
 * config) *and* it belongs to the owner this sheet was opened for.
 *
 * The owner split is what makes the surface owner-aware (#847), read from {@link EMAIL_TEMPLATE_OWNER}.
 * In series mode the only sensible email is the series cover — every other built-in renders against
 * a booking the series invoice has no single one of. In booking mode the series cover is excluded
 * for the mirror-image reason: offered on an ordinary booking it would render a body of pure
 * fallbacks and attach nothing.
 */
export function isComposableEmailTemplate(
  t: Template,
  hasMusicFormConfig: boolean,
  series?: SeriesComposeTarget,
): boolean {
  if (!t.builtInType) return false;
  const owner = EMAIL_TEMPLATE_OWNER[t.builtInType];
  if (owner !== (series ? 'series' : 'booking')) return false;
  return t.builtInType !== 'music_form_invite' || hasMusicFormConfig;
}

/** First template matching the requested built-in type, or null. */
export function findPreselectTemplateId(
  templates: Template[],
  initialTemplateType: string | undefined,
): string | null {
  if (!initialTemplateType) return null;
  return templates.find((t) => t.builtInType === initialTemplateType)?.id ?? null;
}

/** Default issue date = today; due date = today + payment terms (blank when no terms configured). */
export function computeInvoiceDateDefaults(
  defaultPaymentTermsDays: number | undefined,
): { issueDate: string; dueDate: string } {
  const issueDate = new Date().toISOString().slice(0, 10);
  if (!defaultPaymentTermsDays) return { issueDate, dueDate: '' };
  const due = new Date();
  due.setDate(due.getDate() + defaultPaymentTermsDays);
  return { issueDate, dueDate: due.toISOString().slice(0, 10) };
}

/**
 * The render route's owner prefix. Unlike every other owner-derived invoice URL, this one cannot
 * come from `invoiceOwnerRoute`: a template renders with or without an invoice (a contract cover
 * has none), so the owner here is the *sheet's*, not an invoice's. The send URL does go through
 * `invoiceOwnerRoute` — see buildSendRequest.
 */
function renderOwnerPrefix(bookingId: string, series: SeriesComposeTarget | undefined): string {
  return series ? `/series/${series.seriesId}` : `/bookings/${bookingId}`;
}

interface RenderUrlOpts {
  bookingId: string;
  templateId: string;
  invoiceId: string | undefined;
  issueDate: string;
  dueDate: string;
  showDateFields: boolean;
  series?: SeriesComposeTarget;
}

/** Builds the render-preview URL for the selected template; empty string when no template is selected. */
export function buildRenderUrl(opts: RenderUrlOpts): string {
  if (!opts.templateId) return '';
  let url = `${renderOwnerPrefix(opts.bookingId, opts.series)}/communications/render?templateId=${opts.templateId}`;
  if (opts.invoiceId) url += `&invoiceId=${opts.invoiceId}`;
  if (opts.issueDate && opts.showDateFields) url += `&issueDate=${opts.issueDate}`;
  if (opts.dueDate && opts.showDateFields) url += `&dueDate=${opts.dueDate}`;
  return url;
}

interface SendRequestOpts {
  bookingId: string;
  /**
   * The invoice this email attaches, already resolved — absent for a plain (non-invoice) email.
   * Passing the invoice rather than its id is what lets the endpoint come from
   * `invoiceOwnerRoute`, the single declaration of where a mutation on an invoice goes.
   */
  invoice: Invoice | undefined;
  showDateFields: boolean;
  formIssueDate: string;
  formDueDate: string;
  to: string | null;
  contactId: string;
  subject: string;
  body: string;
  templateId: string;
}

/** Resolves the send endpoint + payload — invoice templates route to the invoice-send endpoint. */
export function buildSendRequest(opts: SendRequestOpts): {
  url: string;
  payload: Record<string, unknown>;
} {
  const base: Record<string, unknown> = {
    to: opts.to,
    contactId: opts.contactId,
    subject: opts.subject,
    body: opts.body,
    ...(opts.templateId ? { templateId: opts.templateId } : {}),
  };
  if (opts.invoice) {
    return {
      // Owner-derived from the invoice's own FK, exactly like every other invoice mutation
      // (ADR-0063) — never from the page the compose sheet happens to be mounted on.
      url: `${invoiceOwnerRoute(opts.invoice, 'send').prefix}/${opts.invoice.id}/send`,
      // issueDate/dueDate only for DRAFT; ISSUED invoices have dates from issue time
      payload: {
        ...(opts.showDateFields
          ? { issueDate: opts.formIssueDate, dueDate: opts.formDueDate || undefined }
          : {}),
        ...base,
      },
    };
  }
  return { url: `/bookings/${opts.bookingId}/communications/send`, payload: base };
}

/** Draft-invoice emails can't render or send until an issue date is set. */
function datesReady(showDateFields: boolean, formIssueDate: string): boolean {
  return !showDateFields || !!formIssueDate;
}

interface RenderGateOpts {
  isLoaded: boolean;
  open: boolean;
  hasTemplate: boolean;
  renderUrl: string;
  showDateFields: boolean;
  formIssueDate: string;
}

/** Whether the render-preview query may run (template selected, dates present for draft invoices). */
export function canRenderEmail(opts: RenderGateOpts): boolean {
  const ready = opts.isLoaded && opts.open && opts.hasTemplate && !!opts.renderUrl;
  return ready && datesReady(opts.showDateFields, opts.formIssueDate);
}

interface SendGateOpts {
  hasEmail: boolean;
  hasTemplate: boolean;
  hasSubject: boolean;
  rendering: boolean;
  sending: boolean;
  showDateFields: boolean;
  formIssueDate: string;
  // #533/#631: the selected template is the music-form invite but the form is not published — the
  // API would 409, so the Send button is blocked (not just the dropdown item) with an inline reason.
  musicInviteBlocked?: boolean;
}

/** Whether the Send button is enabled. */
export function canSendEmail(opts: SendGateOpts): boolean {
  if (opts.musicInviteBlocked) return false;
  const ready = opts.hasEmail && opts.hasTemplate && opts.hasSubject && !opts.rendering && !opts.sending;
  return ready && datesReady(opts.showDateFields, opts.formIssueDate);
}
