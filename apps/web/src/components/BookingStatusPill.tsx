import type { BookingStatus } from '@/types/api';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  ENQUIRY:      { label: 'Enquiry',      bg: 'bg-status-enquiry/12',      text: 'text-status-enquiry',      border: 'border-l-status-enquiry'      },
  PROVISIONAL:  { label: 'Provisional',  bg: 'bg-status-provisional/12',  text: 'text-status-provisional',  border: 'border-l-status-provisional'  },
  CONFIRMED:    { label: 'Confirmed',    bg: 'bg-status-confirmed/12',    text: 'text-status-confirmed',    border: 'border-l-status-confirmed'    },
  READY:     { label: 'Ready',     bg: 'bg-status-ready/12',     text: 'text-status-ready',     border: 'border-l-status-ready'     },
  COMPLETE:  { label: 'Complete',  bg: 'bg-status-complete/12',  text: 'text-status-complete',  border: 'border-l-status-complete'  },
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
