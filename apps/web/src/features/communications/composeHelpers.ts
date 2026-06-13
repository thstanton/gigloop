import type { BuiltInTemplateType, Invoice } from '@/types/api';
import { VAR_LABELS } from '@/features/templates/templateMeta';

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

export function formatMissingVariables(keys: string[]): string {
  const labels = keys.map((k) => VAR_LABELS[k] ?? k);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}
