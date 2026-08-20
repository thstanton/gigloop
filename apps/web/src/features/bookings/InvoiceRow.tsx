import { CheckCircle2, Download, Eye, Pencil, Send } from 'lucide-react';
import InvoiceStatusPill from '@/components/common/InvoiceStatusPill';
import { LabelValue } from '@/components/common/LabelValue';
import { GhostButton } from '@/components/common/GhostButton';
import { RowActions } from '@/components/common/RowActions';
import type { RowAction } from '@/components/common/RowActions';
import { PortalVisibility } from '@/components/common/PortalVisibility';
import { cn } from '@/lib/utils';
import { openDocument } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { invoiceLabel, isInvoiceOverdue } from '@/lib/invoiceDerivations';
import type { Invoice, PortalVisibilityVerdict } from '@/types/api';

export interface InvoiceRowHandlers {
  onEdit: (invoice: Invoice) => void;
  onPreview: (invoice: Invoice) => void;
  onIssue: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
  onEditPayment: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
}

export interface InvoiceRowPending {
  isDeletePending: boolean;
  isVoidPending: boolean;
  isIssuePending: boolean;
  isMarkSentPending: boolean;
  isMarkPaidPending: boolean;
}

function invoiceLineTotal(invoice: Invoice): number {
  return invoice.lineItems.reduce((sum, item) => sum + Number.parseFloat(item.amount), 0);
}

function downloadAction(pdfUrl: string): RowAction {
  return {
    label: 'Download',
    icon: <Download size={14} />,
    onClick: () => openDocument(pdfUrl, () => toast({ title: 'Failed to open invoice', variant: 'destructive' })),
  };
}

function voidAction(
  invoice: Invoice,
  handlers: InvoiceRowHandlers,
  pending: InvoiceRowPending,
  description = 'The invoice will be marked void. You can create a new one if needed.',
): RowAction {
  return {
    label: 'Void',
    variant: 'destructive',
    confirmation: { title: 'Void invoice?', description },
    onClick: () => handlers.onVoid(invoice),
    isPending: pending.isVoidPending,
  };
}

// The invoice was issued and its PDF is stored — the ordinary ISSUED state.
function issuedActions(
  invoice: Invoice,
  handlers: InvoiceRowHandlers,
  pending: InvoiceRowPending,
  pdfUrl: string,
): RowAction[] {
  return [
    { label: 'Send', icon: <Send size={14} />, onClick: () => handlers.onSend(invoice) },
    { label: 'Mark as sent', onClick: () => handlers.onMarkSent(invoice), isPending: pending.isMarkSentPending },
    downloadAction(pdfUrl),
    voidAction(invoice, handlers, pending),
  ];
}

// A stored PDF failed to generate at issue time, stranding the invoice: no document to send or
// download. Re-offer Issue so the musician can repair it (#849, ADR-0070) — the number, issue
// date and due date are untouched; only the missing artifact is regenerated.
function strandedIssuedActions(invoice: Invoice, handlers: InvoiceRowHandlers, pending: InvoiceRowPending): RowAction[] {
  return [
    { label: 'Issue', onClick: () => handlers.onIssue(invoice), isPending: pending.isIssuePending },
    voidAction(invoice, handlers, pending),
  ];
}

function getInvoiceActions(
  invoice: Invoice,
  handlers: InvoiceRowHandlers,
  pending: InvoiceRowPending,
  pdfUrl: string | null,
): RowAction[] | null {
  if (invoice.status === 'DRAFT') {
    return [
      { label: 'Create invoice', onClick: () => handlers.onIssue(invoice), isPending: pending.isIssuePending },
      { label: 'Edit', onClick: () => handlers.onEdit(invoice) },
      { label: 'Preview draft', icon: <Eye size={14} />, onClick: () => handlers.onPreview(invoice) },
      {
        label: 'Delete',
        variant: 'destructive',
        confirmation: { title: 'Delete draft invoice?', description: 'This draft will be permanently removed.' },
        onClick: () => handlers.onDelete(invoice),
        isPending: pending.isDeletePending,
      },
    ];
  }

  if (invoice.status === 'ISSUED') {
    return pdfUrl ? issuedActions(invoice, handlers, pending, pdfUrl) : strandedIssuedActions(invoice, handlers, pending);
  }

  if (invoice.status === 'SENT') {
    const acts: RowAction[] = [
      { label: 'Mark as paid', icon: <CheckCircle2 size={14} />, onClick: () => handlers.onMarkPaid(invoice), isPending: pending.isMarkPaidPending },
    ];
    if (pdfUrl) acts.push(downloadAction(pdfUrl));
    acts.push(voidAction(invoice, handlers, pending));
    return acts;
  }

  if (invoice.status === 'PAID') {
    const acts: RowAction[] = [];
    if (pdfUrl) acts.push(downloadAction(pdfUrl));
    acts.push(voidAction(invoice, handlers, pending, 'The invoice will be marked void.'));
    return acts;
  }

  return null;
}

export interface InvoiceRowProps {
  invoice: Invoice;
  pdfUrl: string | null;
  // Per-invoice portal-visibility verdict (ADR-0054), sourced from the invoice's backing document
  // so the badge here, on the document row, and on the portal all agree. Omitted for series
  // invoices, which are not shown on a single booking's portal.
  portalVisibility?: PortalVisibilityVerdict;
  handlers: InvoiceRowHandlers;
  pending: InvoiceRowPending;
}

export default function InvoiceRow({ invoice, pdfUrl, portalVisibility, handlers, pending }: InvoiceRowProps) {
  const overdue = isInvoiceOverdue(invoice);
  const isVoid = invoice.status === 'VOID';
  const isPaid = invoice.status === 'PAID';

  const actions = getInvoiceActions(invoice, handlers, pending, pdfUrl);
  const label = invoiceLabel(invoice);
  const invoiceSublabel = `${formatCurrency(invoiceLineTotal(invoice))} · ${invoice.issueDate ? formatDate(invoice.issueDate) : '—'}`;

  let pendingLabel: string | null = null;
  if (pending.isIssuePending) pendingLabel = 'Creating…';
  else if (pending.isVoidPending) pendingLabel = 'Voiding…';
  else if (pending.isMarkSentPending) pendingLabel = 'Marking sent…';
  else if (pending.isMarkPaidPending) pendingLabel = 'Marking paid…';

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className={cn('text-sm', isVoid ? 'text-muted line-through' : 'text-foreground')}>
          {label}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {invoice.issueDate ? formatDate(invoice.issueDate) : '—'}
          {invoice.dueDate && ` · due ${formatDate(invoice.dueDate)}`}
        </p>
        <div className="mt-1">
          {pendingLabel ? (
            <span className="text-xs text-muted">{pendingLabel}</span>
          ) : (
            <InvoiceStatusPill status={invoice.status} isOverdue={overdue} />
          )}
        </div>
        {/* The recorded money facts (ADR-0068): the date the payment was received and the optional
            reference, shown on the paid invoice with an Edit affordance that re-opens the record
            dialog to correct them (TIM-46). Shown for any paid invoice — a seeded row with a null
            date still offers Edit so the musician can set the real one. */}
        {isPaid && (
          <div className="mt-1.5">
            <LabelValue label="Date received">
              <span className="inline-flex items-center gap-2">
                {invoice.paidAt ? formatDate(invoice.paidAt) : '—'}
                <GhostButton
                  variant="primary"
                  size="xs"
                  icon={<Pencil size={12} />}
                  onClick={() => handlers.onEditPayment(invoice)}
                >
                  Edit
                </GhostButton>
              </span>
            </LabelValue>
            {invoice.paymentReference && <LabelValue label="Reference">{invoice.paymentReference}</LabelValue>}
          </div>
        )}
        {portalVisibility && (
          <div className="mt-1.5">
            <PortalVisibility {...portalVisibility} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn('text-sm font-medium tabular-nums', isVoid ? 'text-muted' : 'text-foreground')}>
          {formatCurrency(invoiceLineTotal(invoice))}
        </span>
        {actions && <RowActions actions={actions} label={label} sublabel={invoiceSublabel} />}
      </div>
    </div>
  );
}
