import { CheckCircle2, Download, Pencil, Send } from 'lucide-react';
import InvoiceStatusPill from '@/components/common/InvoiceStatusPill';
import { RowActions } from '@/components/common/RowActions';
import type { RowAction } from '@/components/common/RowActions';
import { cn } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { Invoice } from '@/types/api';

function invoiceLineTotal(invoice: Invoice): number {
  return invoice.lineItems.reduce((sum, item) => sum + Number.parseFloat(item.amount), 0);
}

function getInvoiceActions(
  invoice: Invoice,
  pdfUrl: string | null,
  onEdit: (i: Invoice) => void,
  onDelete: (i: Invoice) => void,
  onSend: (i: Invoice) => void,
  onMarkSent: (i: Invoice) => void,
  onMarkPaid: (i: Invoice) => void,
  onVoid: (i: Invoice) => void,
): RowAction[] | null {
  if (invoice.status === 'DRAFT') {
    return [
      { label: 'Send', icon: <Send size={14} />, onClick: () => onSend(invoice) },
      { label: 'Edit', icon: <Pencil size={14} />, onClick: () => onEdit(invoice) },
      { label: 'Mark as sent', onClick: () => onMarkSent(invoice) },
      {
        label: 'Delete',
        variant: 'destructive',
        confirmation: { title: 'Delete invoice?', description: 'This invoice will be permanently removed.' },
        onClick: () => onDelete(invoice),
      },
    ];
  }

  if (invoice.status === 'SENT') {
    const acts: RowAction[] = [
      { label: 'Mark as paid', icon: <CheckCircle2 size={14} />, onClick: () => onMarkPaid(invoice) },
    ];
    if (pdfUrl) {
      acts.push({ label: 'Download', icon: <Download size={14} />, onClick: () => window.open(pdfUrl, '_blank', 'noopener,noreferrer') });
    }
    acts.push({
      label: 'Void',
      variant: 'destructive',
      confirmation: { title: 'Void invoice?', description: 'The invoice will be marked void. You can create a new one if needed.' },
      onClick: () => onVoid(invoice),
    });
    return acts;
  }

  if (invoice.status === 'PAID') {
    const acts: RowAction[] = [];
    if (pdfUrl) {
      acts.push({ label: 'Download', icon: <Download size={14} />, onClick: () => window.open(pdfUrl, '_blank', 'noopener,noreferrer') });
    }
    acts.push({
      label: 'Void',
      variant: 'destructive',
      confirmation: { title: 'Void invoice?', description: 'The invoice will be marked void.' },
      onClick: () => onVoid(invoice),
    });
    return acts;
  }

  return null;
}

export interface InvoiceRowProps {
  invoice: Invoice;
  pdfUrl: string | null;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
}

export default function InvoiceRow({ invoice, pdfUrl, onEdit, onDelete, onSend, onMarkSent, onMarkPaid, onVoid }: InvoiceRowProps) {
  const overdue = invoice.status === 'SENT' && !!invoice.dueDate && new Date(invoice.dueDate) < new Date();
  const isVoid = invoice.status === 'VOID';
  const isPaid = invoice.status === 'PAID';

  const actions = getInvoiceActions(invoice, pdfUrl, onEdit, onDelete, onSend, onMarkSent, onMarkPaid, onVoid);

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className={cn('text-sm', isVoid ? 'text-muted line-through' : 'text-foreground')}>
          {invoice.isDeposit ? 'Deposit' : 'Balance'}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {invoice.issueDate ? formatDate(invoice.issueDate) : '—'}
          {invoice.dueDate && ` · due ${formatDate(invoice.dueDate)}`}
          {isPaid && invoice.paidAt && ` · paid ${formatDate(invoice.paidAt)}`}
        </p>
        <div className="mt-1">
          <InvoiceStatusPill status={invoice.status} isOverdue={overdue} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn('text-sm font-medium tabular-nums', isVoid ? 'text-muted' : 'text-foreground')}>
          {formatCurrency(invoiceLineTotal(invoice))}
        </span>
        {actions && <RowActions actions={actions} />}
      </div>
    </div>
  );
}
