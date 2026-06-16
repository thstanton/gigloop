import { CheckCircle2, Download, Eye, Send } from 'lucide-react';
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
  onPreview: (i: Invoice) => void,
  onIssue: (i: Invoice) => void,
  onDelete: (i: Invoice) => void,
  onSend: (i: Invoice) => void,
  onMarkSent: (i: Invoice) => void,
  onMarkPaid: (i: Invoice) => void,
  onVoid: (i: Invoice) => void,
  isDeletePending: boolean,
  isVoidPending: boolean,
  isIssuePending: boolean,
): RowAction[] | null {
  if (invoice.status === 'DRAFT') {
    return [
      { label: 'Create invoice', onClick: () => onIssue(invoice), isPending: isIssuePending },
      { label: 'Edit', onClick: () => onEdit(invoice) },
      { label: 'Preview draft', icon: <Eye size={14} />, onClick: () => onPreview(invoice) },
      {
        label: 'Delete',
        variant: 'destructive',
        confirmation: { title: 'Delete draft invoice?', description: 'This draft will be permanently removed.' },
        onClick: () => onDelete(invoice),
        isPending: isDeletePending,
      },
    ];
  }

  if (invoice.status === 'ISSUED') {
    const acts: RowAction[] = [
      { label: 'Send', icon: <Send size={14} />, onClick: () => onSend(invoice) },
      { label: 'Mark as sent', onClick: () => onMarkSent(invoice) },
    ];
    if (pdfUrl) {
      acts.push({ label: 'Download', icon: <Download size={14} />, onClick: () => window.open(pdfUrl, '_blank', 'noopener,noreferrer') });
    }
    acts.push({
      label: 'Void',
      variant: 'destructive',
      confirmation: { title: 'Void invoice?', description: 'The invoice will be marked void. You can create a new one if needed.' },
      onClick: () => onVoid(invoice),
      isPending: isVoidPending,
    });
    return acts;
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
      isPending: isVoidPending,
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
      isPending: isVoidPending,
    });
    return acts;
  }

  return null;
}

export interface InvoiceRowProps {
  invoice: Invoice;
  pdfUrl: string | null;
  isDeletePending: boolean;
  isVoidPending: boolean;
  isIssuePending: boolean;
  onEdit: (invoice: Invoice) => void;
  onPreview: (invoice: Invoice) => void;
  onIssue: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
}

export default function InvoiceRow({ invoice, pdfUrl, isDeletePending, isVoidPending, isIssuePending, onEdit, onPreview, onIssue, onDelete, onSend, onMarkSent, onMarkPaid, onVoid }: InvoiceRowProps) {
  // Overdue only applies to SENT invoices — an ISSUED invoice past its due date is not overdue
  const overdue = invoice.status === 'SENT' && !!invoice.dueDate && new Date(invoice.dueDate) < new Date();
  const isVoid = invoice.status === 'VOID';
  const isPaid = invoice.status === 'PAID';

  const actions = getInvoiceActions(invoice, pdfUrl, onEdit, onPreview, onIssue, onDelete, onSend, onMarkSent, onMarkPaid, onVoid, isDeletePending, isVoidPending, isIssuePending);
  const invoiceLabel = invoice.isDeposit ? 'Deposit' : 'Balance';
  const invoiceSublabel = `${formatCurrency(invoiceLineTotal(invoice))} · ${invoice.issueDate ? formatDate(invoice.issueDate) : '—'}`;

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
          {isIssuePending ? (
            <span className="text-xs text-muted">Creating…</span>
          ) : (
            <InvoiceStatusPill status={invoice.status} isOverdue={overdue} />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn('text-sm font-medium tabular-nums', isVoid ? 'text-muted' : 'text-foreground')}>
          {formatCurrency(invoiceLineTotal(invoice))}
        </span>
        {actions && <RowActions actions={actions} label={invoiceLabel} sublabel={invoiceSublabel} />}
      </div>
    </div>
  );
}
