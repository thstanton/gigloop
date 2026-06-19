import { Copy, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { formatDate } from '@/lib/formatters';
import { DateBadge } from '@/components/common/DateBadge';
import type { BookingListItem } from '@/types/api';

export interface SeriesEventsCardProps {
  bookings: BookingListItem[];
  isLoading: boolean;
  /** "Exact same gig again" — clones this booking into the series (#507 / ADR-0049). */
  onCopyEvent: () => void;
  onAddToSeries: () => void;
}

export function SeriesEventsCard({ bookings, isLoading, onCopyEvent, onAddToSeries }: SeriesEventsCardProps) {
  const navigate = useNavigate();

  const action = (
    <div className="flex items-center gap-3">
      <GhostButton onClick={onCopyEvent} variant="primary" size="xs" icon={<Copy size={12} />}>
        Copy event
      </GhostButton>
      <GhostButton onClick={onAddToSeries} variant="muted" size="xs" icon={<Plus size={12} />}>
        Add to series
      </GhostButton>
    </div>
  );

  if (isLoading) {
    return (
      <Card title="Events in Series" action={action}>
        <div className="h-9 bg-border rounded animate-pulse" />
      </Card>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card title="Events in Series" action={action}>
        <p className="text-sm text-muted py-1">No other events in this series yet.</p>
      </Card>
    );
  }

  return (
    <Card title="Events in Series" action={action}>
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
