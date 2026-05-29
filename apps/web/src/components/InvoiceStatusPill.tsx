import type { InvoiceStatus } from '@/types/api';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-status-completed/12', text: 'text-status-completed', border: 'border-l-status-completed' },
  SENT:  { label: 'Sent',  bg: 'bg-status-invoiced/12',  text: 'text-status-invoiced',  border: 'border-l-status-invoiced'  },
  PAID:  { label: 'Paid',  bg: 'bg-status-confirmed/12', text: 'text-status-confirmed', border: 'border-l-status-confirmed' },
  VOID:  { label: 'Void',  bg: 'bg-muted/40',            text: 'text-muted',            border: 'border-l-muted'            },
};

interface InvoiceStatusPillProps {
  status: InvoiceStatus;
  isOverdue?: boolean;
  className?: string;
}

export default function InvoiceStatusPill({ status, isOverdue, className }: InvoiceStatusPillProps) {
  const { bg, text, border, label } = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium',
        isOverdue
          ? 'bg-status-cancelled/12 text-status-cancelled border-l-status-cancelled'
          : cn(bg, text, border),
        className,
      )}
    >
      {isOverdue ? 'Overdue' : label}
    </span>
  );
}
