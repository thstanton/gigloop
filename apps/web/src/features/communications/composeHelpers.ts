import type { BuiltInTemplateType, Invoice } from '@/types/api';
import { VAR_LABELS } from '@/features/templates/templateMeta';

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
