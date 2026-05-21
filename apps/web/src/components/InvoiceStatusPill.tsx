import type { InvoiceStatus } from '@/types/api';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-status-completed/12', text: 'text-status-completed' },
  SENT:  { label: 'Sent',  bg: 'bg-status-invoiced/12',  text: 'text-status-invoiced'  },
  PAID:  { label: 'Paid',  bg: 'bg-status-confirmed/12', text: 'text-status-confirmed' },
};

interface InvoiceStatusPillProps {
  status: InvoiceStatus;
  isOverdue?: boolean;
  className?: string;
}

export default function InvoiceStatusPill({ status, isOverdue, className }: InvoiceStatusPillProps) {
  const { bg, text, label } = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        isOverdue
          ? 'bg-status-cancelled/12 text-status-cancelled'
          : cn(bg, text),
        className,
      )}
    >
      {isOverdue ? 'Overdue' : label}
    </span>
  );
}
