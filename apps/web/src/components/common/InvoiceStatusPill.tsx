import type { InvoiceStatus } from '@/types/api';
import { StatusPill } from '@/components/common/StatusPill';
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
  if (isOverdue) {
    return (
      <StatusPill
        label="Overdue"
        bg="bg-status-cancelled/12"
        text="text-status-cancelled"
        border="border-l-status-cancelled"
        className={cn(className)}
      />
    );
  }
  const config = STATUS_CONFIG[status];
  return <StatusPill {...config} className={cn(className)} />;
}
