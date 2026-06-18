import type { BuiltInTemplateType, Invoice, Template } from '@/types/api';
import { VAR_LABELS, BUILT_IN_EMAIL_TYPES } from '@/features/templates/templateMeta';

const ATTACHMENT_TEMPLATE_TYPES: BuiltInTemplateType[] = [
  'deposit_invoice_cover',
  'balance_invoice_cover',
  'contract_and_deposit_cover',
];

export type AttachmentState =
  | { kind: 'present'; filename: string }
  | { kind: 'warning'; message: string }
  | null;

export function getInvoiceIdForTemplate(
  type: BuiltInTemplateType | null,
  invoices: Invoice[],
): string | undefined {
  if (type === 'deposit_invoice_cover' || type === 'contract_and_deposit_cover') {
    return invoices.find((i) => i.isDeposit && i.status !== 'VOID')?.id;
  }
  if (type === 'balance_invoice_cover') {
    return invoices.find((i) => !i.isDeposit && i.status !== 'VOID')?.id;
  }
  return undefined;
}

export function shouldHideTemplate(
  type: BuiltInTemplateType,
  invoices: Invoice[],
  bookingDate: string,
): boolean {
  if (
    (type === 'deposit_invoice_cover' || type === 'contract_and_deposit_cover') &&
    !invoices.some((i) => i.isDeposit)
  ) return true;
  if (type === 'balance_invoice_cover' && !invoices.some((i) => !i.isDeposit)) return true;
  if (type === 'thank_you') {
    const date = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }
  return false;
}

function resolveAttachmentFilename(invoice: Invoice | undefined): string {
  if (invoice?.invoiceNumber) return `Invoice ${invoice.invoiceNumber}.pdf`;
  if (invoice?.isDeposit) return 'Deposit invoice PDF';
  return 'Balance invoice PDF';
}

export function getAttachmentState(
  type: BuiltInTemplateType | null,
  invoices: Invoice[],
): AttachmentState {
  if (!type || !ATTACHMENT_TEMPLATE_TYPES.includes(type)) return null;

  const invoiceId = getInvoiceIdForTemplate(type, invoices);
  if (!invoiceId) {
    return {
      kind: 'warning',
      message:
        type === 'balance_invoice_cover'
          ? 'No balance invoice to attach'
          : 'No deposit invoice to attach',
    };
  }

  const invoice = invoices.find((i) => i.id === invoiceId);
  const filename = resolveAttachmentFilename(invoice);

  return { kind: 'present', filename };
}

export function formatMissingVariables(keys: string[]): string {
  const labels = keys.map((k) => VAR_LABELS[k] ?? k);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/** A template is composable as an email when it is a built-in email type (music-form invites need config). */
export function isComposableEmailTemplate(t: Template, hasMusicFormConfig: boolean): boolean {
  return (
    !!t.builtInType &&
    BUILT_IN_EMAIL_TYPES.includes(t.builtInType as BuiltInTemplateType) &&
    (t.builtInType !== 'music_form_invite' || hasMusicFormConfig)
  );
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

interface RenderUrlOpts {
  bookingId: string;
  templateId: string;
  invoiceId: string | undefined;
  issueDate: string;
  dueDate: string;
  showDateFields: boolean;
}

/** Builds the render-preview URL for the selected template; empty string when no template is selected. */
export function buildRenderUrl(opts: RenderUrlOpts): string {
  if (!opts.templateId) return '';
  let url = `/bookings/${opts.bookingId}/communications/render?templateId=${opts.templateId}`;
  if (opts.invoiceId) url += `&invoiceId=${opts.invoiceId}`;
  if (opts.issueDate && opts.showDateFields) url += `&issueDate=${opts.issueDate}`;
  if (opts.dueDate && opts.showDateFields) url += `&dueDate=${opts.dueDate}`;
  return url;
}

interface SendRequestOpts {
  bookingId: string;
  invoiceId: string | undefined;
  isInvoiceEmail: boolean;
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
  if (opts.isInvoiceEmail && opts.invoiceId) {
    return {
      url: `/bookings/${opts.bookingId}/invoices/${opts.invoiceId}/send`,
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
}

/** Whether the Send button is enabled. */
export function canSendEmail(opts: SendGateOpts): boolean {
  const ready = opts.hasEmail && opts.hasTemplate && opts.hasSubject && !opts.rendering && !opts.sending;
  return ready && datesReady(opts.showDateFields, opts.formIssueDate);
}
