import type { BookingStatus } from '@/types/api';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  ENQUIRY:   { label: 'Enquiry',   bg: 'bg-status-enquiry/12',   text: 'text-status-enquiry',   border: 'border-l-status-enquiry'   },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-status-confirmed/12', text: 'text-status-confirmed', border: 'border-l-status-confirmed' },
  INVOICED:  { label: 'Invoiced',  bg: 'bg-status-invoiced/12',  text: 'text-status-invoiced',  border: 'border-l-status-invoiced'  },
  SETTLED:   { label: 'Settled',   bg: 'bg-status-settled/12',   text: 'text-status-settled',   border: 'border-l-status-settled'   },
  COMPLETED: { label: 'Completed', bg: 'bg-status-completed/12', text: 'text-status-completed', border: 'border-l-status-completed' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-status-cancelled/12', text: 'text-status-cancelled', border: 'border-l-status-cancelled' },
};

interface BookingStatusPillProps {
  status: BookingStatus;
  className?: string;
}

export default function BookingStatusPill({ status, className }: BookingStatusPillProps) {
  const { label, bg, text, border } = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium',
        bg,
        text,
        border,
        className,
      )}
    >
      {label}
    </span>
  );
}
