import { CheckCircle2, ChevronDown, Download, Pencil, Send } from 'lucide-react';
import InvoiceStatusPill from '@/components/common/InvoiceStatusPill';
import { IconButton } from '@/components/common/IconButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDate, formatCurrency } from '@/lib/formatters';
import type { Invoice } from '@/types/api';

function invoiceLineTotal(invoice: Invoice): number {
  return invoice.lineItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
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

export default function InvoiceRow({
  invoice,
  pdfUrl,
  onEdit,
  onDelete,
  onSend,
  onMarkSent,
  onMarkPaid,
  onVoid,
}: InvoiceRowProps) {
  const overdue =
    invoice.status === 'SENT' &&
    !!invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();
  const total = invoiceLineTotal(invoice);
  const isDraft = invoice.status === 'DRAFT';
  const isSent = invoice.status === 'SENT';
  const isPaid = invoice.status === 'PAID';
  const isVoid = invoice.status === 'VOID';

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
          {formatCurrency(total)}
        </span>
        {isDraft && (
          <>
            <IconButton label="Send invoice" onClick={() => onSend(invoice)}>
              <Send size={14} />
            </IconButton>
            <IconButton label="Edit invoice" onClick={() => onEdit(invoice)}>
              <Pencil size={14} />
            </IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="More actions">
                  <ChevronDown size={14} />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onMarkSent(invoice)}>
                  Mark as sent
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(invoice)}
                  className="text-status-cancelled focus:text-status-cancelled"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        {isSent && (
          <button
            onClick={() => onMarkPaid(invoice)}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Mark invoice as paid"
          >
            <CheckCircle2 size={14} />
          </button>
        )}
        {(isSent || isPaid) && pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Download invoice PDF"
          >
            <Download size={14} />
          </a>
        )}
        {(isSent || isPaid) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-muted hover:text-foreground transition-colors"
                aria-label="More actions"
              >
                <ChevronDown size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onVoid(invoice)}
                className="text-status-cancelled focus:text-status-cancelled"
              >
                Void invoice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
