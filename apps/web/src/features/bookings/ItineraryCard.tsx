import { useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDuration } from './PerformanceSection';
import FormatIcon from './FormatIcon';
import { LOGISTICS_FIELD_ICONS } from '@/lib/constants';
import type { BookingLogisticsEntry, BookingPackageSummary, PerformanceSet } from '@/types/api';

type TimelineRow =
  | { kind: 'time'; rowKey: string; label: string; time: string; notes?: string; group: string }
  | { kind: 'set'; rowKey: string; set: PerformanceSet; group: string };

interface ItineraryCardProps {
  logistics: Record<string, BookingLogisticsEntry> | null;
  sets: PerformanceSet[];
  packages: BookingPackageSummary[];
  hideWhenEmpty?: boolean;
}

/** "HH:MM" → minutes since midnight, or null when unset/unparseable. */
function startMinutes(startTime: string | null): number | null {
  if (!startTime) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Canonical itinerary order (ADR-0046 decoupling): start time drives the running
 * order, NOT package grouping. Sets without a start time fall back to package
 * order (then set order) and lead the timed sets — so an untimed Ceremony still
 * heads the day. Set order alone is no longer authoritative.
 */
export function orderTimelineSets(
  sets: PerformanceSet[],
  packages: BookingPackageSummary[],
): PerformanceSet[] {
  const pkgOrder = new Map(packages.map((p) => [p.id, p.order]));
  // Ungrouped sets (no packageId) and sets whose package is missing sort last among the fallback.
  const fallbackPkgOrder = (s: PerformanceSet): number =>
    s.packageId != null ? (pkgOrder.get(s.packageId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;

  return [...sets].sort((a, b) => {
    const ta = startMinutes(a.startTime);
    const tb = startMinutes(b.startTime);
    // Untimed sets lead timed sets; among timed sets, earlier time wins.
    if (ta == null && tb != null) return -1;
    if (ta != null && tb == null) return 1;
    if (ta != null && tb != null && ta !== tb) return ta - tb;
    // Both untimed, or timed at the same minute: fall back to package then set order.
    const pa = fallbackPkgOrder(a);
    const pb = fallbackPkgOrder(b);
    if (pa !== pb) return pa - pb;
    return a.order - b.order;
  });
}

function buildRows(
  logistics: Record<string, BookingLogisticsEntry> | null,
  sets: PerformanceSet[],
  packages: BookingPackageSummary[],
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const l = logistics ?? {};

  if (l.arrivalTime?.value)
    rows.push({ kind: 'time', rowKey: 'arrivalTime', label: 'Arrival', time: l.arrivalTime.value, notes: l.arrivalTime.notes, group: 'arrival' });
  if (l.soundCheckTime?.value)
    rows.push({ kind: 'time', rowKey: 'soundCheckTime', label: 'Soundcheck', time: l.soundCheckTime.value, notes: l.soundCheckTime.notes, group: 'soundcheck' });

  for (const set of orderTimelineSets(sets, packages))
    rows.push({ kind: 'set', rowKey: set.id, set, group: set.packageId ? `pkg-${set.packageId}` : `set-${set.id}` });

  if (l.finishTime?.value)
    rows.push({ kind: 'time', rowKey: 'finishTime', label: 'Finish', time: l.finishTime.value, notes: l.finishTime.notes, group: 'finish' });

  return rows;
}

function setLabel(set: PerformanceSet): string {
  const dur = formatDuration(set.duration);
  return set.label ? `${set.label} (${dur})` : dur;
}

function getSetIcon(set: PerformanceSet, packages: BookingPackageSummary[]): string {
  if (!set.packageId) return 'music';
  const pkg = packages.find((p) => p.id === set.packageId);
  return pkg?.icon ?? 'music';
}

export default function ItineraryCard({ logistics, sets, packages, hideWhenEmpty = false }: ItineraryCardProps) {
  const [, setSearchParams] = useSearchParams();
  const rows = buildRows(logistics, sets, packages);

  if (hideWhenEmpty && rows.length === 0) return null;

  return (
    <Card
      title="Itinerary"
      action={
        <GhostButton variant="primary" size="xs" onClick={() => setSearchParams({ sheet: 'bookingEdit', section: 'onTheDay' })}>
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
                className={`flex gap-3 py-1.5${(row.kind === 'time' && row.notes) ? ' items-start' : ' items-center'}${showBorder ? ' border-b border-border' : ''}`}
              >
                <span className="w-14 flex-shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {timeCol}
                </span>
                {row.kind === 'time' && (
                  <span className="flex-shrink-0 text-muted">
                    <FormatIcon icon={LOGISTICS_FIELD_ICONS[row.rowKey] ?? 'clock'} size={14} />
                  </span>
                )}
                {row.kind === 'set' && (
                  <span className="flex-shrink-0 text-muted">
                    <FormatIcon icon={getSetIcon(row.set, packages)} size={14} />
                  </span>
                )}
                {row.kind === 'time' && row.notes ? (
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground">{labelCol}</span>
                    <span className="text-xs text-muted">{row.notes}</span>
                  </div>
                ) : (
                  <span className="text-sm text-foreground">{labelCol}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
