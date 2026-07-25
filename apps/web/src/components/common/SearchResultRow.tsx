import { CalendarDays, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SearchResult } from '@/types/api';
import BookingStatusPill from '@/components/common/BookingStatusPill';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface SearchResultRowProps {
  result: SearchResult;
  /**
   * Called when the row is activated. The row **never navigates itself** — the caller reads
   * `result.url` (or the whole result) and routes. Omit it to render the row as inert content,
   * e.g. an Ask-mode answer card reusing the same shape (ADR-0067 §8).
   */
  onSelect?: (result: SearchResult) => void;
  className?: string;
}

interface RowShape {
  Icon: LucideIcon;
  title: string;
  subtitle: string | null;
  trailing: ReactNode;
}

/** Derive the visual shape from the discriminant, so a new `SearchResult` variant is one more case. */
function toRowShape(result: SearchResult): RowShape {
  switch (result.type) {
    case 'booking':
      return {
        Icon: CalendarDays,
        title: result.title,
        subtitle: [formatDate(result.date), result.subtitle].filter(Boolean).join(' · '),
        trailing: <BookingStatusPill status={result.status} />,
      };
    case 'contact':
      return {
        Icon: User,
        title: result.title,
        subtitle: result.subtitle,
        trailing: (
          <span className="text-sm text-muted whitespace-nowrap">
            {result.bookingCount} booking{result.bookingCount === 1 ? '' : 's'}
          </span>
        ),
      };
  }
}

/**
 * One search result, rendered by `type` — a booking (date · venue + status pill) or a contact
 * (email/phone + booking count). Purely presentational: no data fetching, no routing. Kept
 * reusable so the palette list and a future Ask answer can render the same card (ADR-0067 §5, §8).
 */
export function SearchResultRow({ result, onSelect, className }: SearchResultRowProps) {
  const { Icon, title, subtitle, trailing } = toRowShape(result);

  const content = (
    <>
      <Icon size={18} className="shrink-0 text-muted" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle && <span className="truncate text-sm text-muted">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </>
  );

  const shell = 'flex w-full items-center gap-3 rounded-md px-3 py-2';

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(result)}
        className={cn(shell, 'text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none', className)}
      >
        {content}
      </button>
    );
  }

  return <div className={cn(shell, className)}>{content}</div>;
}
