import { CopyPlus, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/common/Card';
import type { CardMenuItem } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { formatDate } from '@/lib/formatters';
import { DateBadge } from '@/components/common/DateBadge';
import type { BookingListItem } from '@/types/api';

export interface SeriesEventsCardProps {
  bookings: BookingListItem[];
  isLoading: boolean;
  /** "Exact same gig again" — clones this booking into the series (#507 / ADR-0049). */
  onCopyEvent: () => void;
  /** "Same series, different gig" — opens the new-booking form pre-filled with identity only (#508 / ADR-0049). */
  onAddToSeries: () => void;
}

export function SeriesEventsCard({ bookings, isLoading, onCopyEvent, onAddToSeries }: SeriesEventsCardProps) {
  const navigate = useNavigate();

  // Primary "Repeat this booking" is an above-the-fold labelled button; the Card's "…" menu
  // lists every action including the shortcut one.
  const action = (
    <GhostButton onClick={onCopyEvent} variant="primary" size="xs" icon={<CopyPlus size={12} />}>
      Repeat this booking
    </GhostButton>
  );

  const menu: CardMenuItem[] = [
    {
      label: 'Repeat this booking',
      description: 'Copies everything onto a new date',
      icon: <CopyPlus size={16} />,
      onClick: onCopyEvent,
    },
    {
      label: 'New booking in series',
      description: 'Same client, different gig',
      icon: <Plus size={16} />,
      onClick: onAddToSeries,
    },
  ];

  if (isLoading) {
    return (
      <Card title="Bookings in Series" action={action} menu={menu}>
        <div className="h-9 bg-border rounded animate-pulse" />
      </Card>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card title="Bookings in Series" action={action} menu={menu}>
        <p className="text-sm text-muted py-1">No other bookings in this series yet.</p>
      </Card>
    );
  }

  return (
    <Card title="Bookings in Series" action={action} menu={menu}>
      <ul className="divide-y divide-border">
        {bookings.map((b) => (
          <li key={b.id}>
            <button
              onClick={() => navigate(`/admin/bookings/${b.id}`)}
              className="w-full flex items-start gap-3 py-3 text-left hover:bg-muted/30 transition-colors -mx-4 px-4"
            >
              <DateBadge date={b.date} size="sm" className="mt-0.5" />
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-sm text-foreground truncate">
                  {b.title ?? b.customer.name}
                </span>
                {b.title && (
                  <span className="text-xs text-muted truncate">{b.customer.name}</span>
                )}
                {b.venue && (
                  <span className="text-xs text-muted truncate">{b.venue.name}</span>
                )}
              </div>
              <span className="text-xs text-muted flex-shrink-0 mt-0.5">{formatDate(b.date)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
