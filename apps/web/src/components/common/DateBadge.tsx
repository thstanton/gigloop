import { cn } from '@/lib/utils';
import { formatDateBadge } from '@/lib/formatters';

/**
 * A tear-off calendar page showing a booking's day + month, used as a leading
 * visual anchor wherever a booking is referenced. Dates are first-class in
 * GigMan — see the "date as first-class anchor" design principle in CONTEXT.md.
 *
 * Purely presentational: takes an ISO date and a size, nothing booking-aware.
 * The year is deliberately NOT shown here. Time is never shown. Weekday appears
 * on `lg` only; the smaller sizes omit it.
 */
export type DateBadgeSize = 'sm' | 'md' | 'lg';

const SIZE: Record<DateBadgeSize, { box: string; strip: string; day: string; weekday: boolean; wd: string }> = {
  sm: { box: 'w-9', strip: 'text-[9px] py-px', day: 'text-base py-0.5', weekday: false, wd: '' },
  md: { box: 'w-11', strip: 'text-[10px] py-0.5', day: 'text-xl py-0.5', weekday: false, wd: '' },
  lg: { box: 'w-14', strip: 'text-[11px] py-0.5', day: 'text-3xl pt-0', weekday: true, wd: 'text-[10px] pb-0.5' },
};

interface DateBadgeProps {
  /** ISO date string (the time component, if any, is ignored). */
  date: string;
  size?: DateBadgeSize;
  className?: string;
}

export function DateBadge({ date, size = 'md', className }: DateBadgeProps) {
  const { day, month, weekday, full } = formatDateBadge(date);
  const s = SIZE[size];
  return (
    <span
      aria-label={full}
      className={cn(
        'inline-flex flex-col flex-shrink-0 overflow-hidden rounded-md border border-border bg-background text-center',
        s.box,
        className,
      )}
    >
      <span className={cn('bg-date-badge font-semibold uppercase leading-none tracking-wide text-white', s.strip)}>
        {month}
      </span>
      <span className={cn('font-bold leading-none text-foreground', s.day)}>{day}</span>
      {s.weekday && (
        <span className={cn('font-medium uppercase leading-none tracking-wide text-muted', s.wd)}>{weekday}</span>
      )}
    </span>
  );
}
