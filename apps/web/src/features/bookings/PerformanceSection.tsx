import { useSearchParams } from 'react-router-dom';
import { Music } from 'lucide-react';
import { Card } from '@/components/common/Card';
import FormatIcon from './FormatIcon';
import type { BookingDetail, PerformanceSet } from '@/types/api';

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export interface PerformanceSectionProps {
  booking: BookingDetail;
  hideWhenEmpty?: boolean;
}

export default function PerformanceSection({ booking, hideWhenEmpty = false }: PerformanceSectionProps) {
  const [, setSearchParams] = useSearchParams();
  const setsByFormatId = new Map<string | null, PerformanceSet[]>();
  for (const set of booking.sets ?? []) {
    const key = set.packageId ?? null;
    if (!setsByFormatId.has(key)) setsByFormatId.set(key, []);
    setsByFormatId.get(key)!.push(set);
  }
  const unassigned = setsByFormatId.get(null) ?? [];

  if ((booking.packages ?? []).length === 0 && unassigned.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div className="flex flex-col items-center text-center gap-2 py-4 text-muted min-h-[5rem]">
        <Music size={20} />
        <span className="text-sm font-medium">Performance</span>
        <button
          type="button"
          onClick={() => setSearchParams({ sheet: 'bookingEdit', section: 'packages' })}
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          + Add packages
        </button>
      </div>
    );
  }

  return (
    <Card
      title="Performance"
      action={
        <button
          type="button"
          onClick={() => setSearchParams({ sheet: 'bookingEdit', section: 'packages' })}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Edit
        </button>
      }
    >

      {(booking.packages ?? []).map((bpf) => {
        const sets = setsByFormatId.get(bpf.packageId) ?? [];
        return (
          <div key={bpf.id} className="mb-4 last:mb-0">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1">
              <FormatIcon icon={bpf.package.icon} />
              {bpf.package.label}
            </div>
            {sets.map((set) => (
              <div key={set.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                <span className="flex-1 text-sm text-foreground">
                  {[set.label, formatDuration(set.duration)].filter(Boolean).join(' · ')}
                </span>
                {set.startTime && (
                  <span className="text-sm text-muted flex-shrink-0">{set.startTime}</span>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted mb-1">Other sets</p>
          {unassigned.map((set) => (
            <div key={set.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
              <span className="flex-1 text-sm text-foreground">
                {[set.label, formatDuration(set.duration)].filter(Boolean).join(' · ')}
              </span>
              {set.startTime && (
                <span className="text-sm text-muted flex-shrink-0">{set.startTime}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
