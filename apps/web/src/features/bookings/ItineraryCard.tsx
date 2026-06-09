import { Clock } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDuration } from './PerformanceSection';
import type { BookingLogisticsEntry, PerformanceSet } from '@/types/api';

type TimelineRow =
  | { kind: 'time'; rowKey: string; label: string; time: string; group: string }
  | { kind: 'set'; rowKey: string; set: PerformanceSet; group: string };

interface ItineraryCardProps {
  logistics: Record<string, BookingLogisticsEntry> | null;
  sets: PerformanceSet[];
  onEdit: () => void;
}

function buildRows(
  logistics: Record<string, BookingLogisticsEntry> | null,
  sets: PerformanceSet[],
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const l = logistics ?? {};

  if (l.arrivalTime?.value)
    rows.push({ kind: 'time', rowKey: 'arrival', label: 'Arrival', time: l.arrivalTime.value, group: 'arrival' });
  if (l.soundCheckTime?.value)
    rows.push({ kind: 'time', rowKey: 'soundcheck', label: 'Soundcheck', time: l.soundCheckTime.value, group: 'soundcheck' });

  for (const set of [...sets].sort((a, b) => a.order - b.order))
    rows.push({ kind: 'set', rowKey: set.id, set, group: set.packageId ? `pkg-${set.packageId}` : `set-${set.id}` });

  if (l.finishTime?.value)
    rows.push({ kind: 'time', rowKey: 'finish', label: 'Finish', time: l.finishTime.value, group: 'finish' });

  return rows;
}

function setLabel(set: PerformanceSet): string {
  const dur = formatDuration(set.duration);
  return set.label ? `${set.label} (${dur})` : dur;
}

export default function ItineraryCard({ logistics, sets, onEdit }: ItineraryCardProps) {
  const rows = buildRows(logistics, sets);

  return (
    <Card
      title="Itinerary"
      action={
        <GhostButton variant="primary" size="xs" onClick={onEdit}>
          Edit
        </GhostButton>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<Clock size={24} />}
          heading="No itinerary yet"
          description="Add times and sets to build a timeline of the day."
          className="py-6"
        />
      ) : (
        <div>
          {rows.map((row, i) => {
            const showBorder = !!rows[i + 1] && rows[i + 1].group !== row.group;
            const timeCol = row.kind === 'time' ? row.time : (row.set.startTime ?? formatDuration(row.set.duration));
            const labelCol = row.kind === 'time' ? row.label : setLabel(row.set);
            return (
              <div
                key={row.rowKey}
                className={`flex items-center gap-3 py-1.5${showBorder ? ' border-b border-border' : ''}`}
              >
                <span className="w-14 flex-shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {timeCol}
                </span>
                <span className="text-sm text-foreground">
                  {labelCol}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
