import type { InvoiceStatus } from '@/types/api';
import { StatusPill } from '@/components/common/StatusPill';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; text: string; border: string }> = {
  DRAFT:   { label: 'Draft',   bg: 'bg-status-complete/15',    text: 'text-status-complete',    border: 'border-l-status-complete'    },
  ISSUED:  { label: 'Issued',  bg: 'bg-status-enquiry/15',     text: 'text-status-enquiry',     border: 'border-l-status-enquiry'     },
  SENT:    { label: 'Sent',    bg: 'bg-status-provisional/15', text: 'text-status-provisional', border: 'border-l-status-provisional' },
  PAID:    { label: 'Paid',    bg: 'bg-status-confirmed/15',   text: 'text-status-confirmed',   border: 'border-l-status-confirmed'   },
  VOID:    { label: 'Void',    bg: 'bg-muted/40',              text: 'text-muted',              border: 'border-l-muted'              },
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
        bg="bg-status-cancelled/15"
        text="text-status-cancelled"
        border="border-l-status-cancelled"
        className={cn(className)}
      />
    );
  }
  const config = STATUS_CONFIG[status];
  return <StatusPill {...config} className={cn(className)} />;
}
