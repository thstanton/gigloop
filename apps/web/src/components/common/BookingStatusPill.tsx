import type { BookingStatus } from '@/types/api';
import { StatusPill } from '@/components/common/StatusPill';
import { BOOKING_STATUS_LABELS, STATUS_TOKENS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface BookingStatusPillProps {
  status: BookingStatus;
  className?: string;
}

export default function BookingStatusPill({ status, className }: BookingStatusPillProps) {
  const { tint, text, borderL } = STATUS_TOKENS[status];
  return (
    <StatusPill
      label={BOOKING_STATUS_LABELS[status]}
      bg={tint}
      text={text}
      border={borderL}
      className={cn(className)}
    />
  );
}
