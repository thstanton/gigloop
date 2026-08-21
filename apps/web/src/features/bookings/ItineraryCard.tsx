import { Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Pencil, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import FormatIcon from './FormatIcon';
import { segmentLabel } from './BandAtom';
import { LOGISTICS_FIELD_ICONS } from '@/lib/constants';
import type { BookingBandChair, BookingBandMember, BookingLogisticsEntry, BookingPackageSummary, PerformanceSet } from '@/types/api';

type TimelineRow =
  | { kind: 'time'; rowKey: string; label: string; time: string; notes?: string; group: string }
  | { kind: 'set'; rowKey: string; set: PerformanceSet; group: string; pkg: BookingPackageSummary | null; startsRun: boolean };

interface ItineraryCardProps {
  logistics: Record<string, BookingLogisticsEntry> | null;
  sets: PerformanceSet[];
  packages: BookingPackageSummary[];
  hideWhenEmpty?: boolean;
  /** The band roster (#887, ADR-0072 §6) — rendered inline under each package header, read-only.
   *  Presentational: this card issues no fetch of its own, so the host passes `[]` when the band
   *  members flag is off, which keeps the roster absent with no other branching here. */
  bandChairs?: BookingBandChair[];
  bandMembers?: BookingBandMember[];
}

/** One package's (or "Whole day"'s) roster: role, who (or "Vacant"), and the derived call time —
 *  no click, this surface only answers "who plays what and when" (ADR-0072 §6). */
function PackageRoster({ chairs, memberById }: { chairs: BookingBandChair[]; memberById: Map<string, BookingBandMember> }) {
  const sorted = [...chairs].sort((a, b) => a.order - b.order);
  return (
    <div className="mb-2 flex flex-col gap-1 rounded-md border border-border bg-surface px-2 py-1.5">
      {sorted.map((chair) => {
        const member = chair.memberId ? memberById.get(chair.memberId) : undefined;
        return (
          <div key={chair.id} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="flex-shrink-0">{chair.role}</Badge>
            <span className={cn('flex-1 truncate', member ? 'text-foreground' : 'italic text-muted')}>
              {member ? member.contact.name : 'Vacant'}
            </span>
            {chair.callTime && <span className="flex-shrink-0 tabular-nums text-muted">{chair.callTime}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Minutes → human duration, e.g. 45 → "45 min", 90 → "1 hr 30 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
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

  // Sets ordered by time; each contiguous run of the same package leads with a package header
  // (its name + icon), so the grouping the musician built in the editor reads at a glance.
  const orderedSets = orderTimelineSets(sets, packages);
  orderedSets.forEach((set, i) => {
    const pkg = set.packageId ? packages.find((p) => p.id === set.packageId) ?? null : null;
    const prev = orderedSets[i - 1];
    const startsRun = !!set.packageId && (!prev || prev.packageId !== set.packageId);
    rows.push({
      kind: 'set',
      rowKey: set.id,
      set,
      group: set.packageId ? `pkg-${set.packageId}` : `set-${set.id}`,
      pkg,
      startsRun,
    });
  });

  if (l.finishTime?.value)
    rows.push({ kind: 'time', rowKey: 'finishTime', label: 'Finish', time: l.finishTime.value, notes: l.finishTime.notes, group: 'finish' });

  return rows;
}

function setLabel(set: PerformanceSet): string {
  const dur = formatDuration(set.duration);
  return set.label ? `${set.label} (${dur})` : dur;
}

export default function ItineraryCard({
  logistics,
  sets,
  packages,
  hideWhenEmpty = false,
  bandChairs = [],
  bandMembers = [],
}: ItineraryCardProps) {
  const [, setSearchParams] = useSearchParams();
  const rows = buildRows(logistics, sets, packages);
  const hasRoster = bandChairs.length > 0;

  if (hideWhenEmpty && rows.length === 0 && !hasRoster) return null;

  if (rows.length === 0 && !hasRoster) {
    return (
      <EmptyState
        icon={<Clock size={24} />}
        heading="No itinerary yet"
        description="Add times and sets to build a timeline of the day."
        action={
          <GhostButton variant="primary" size="xs" icon={<Plus size={13} />} onClick={() => setSearchParams({ sheet: 'itineraryTweak' })}>
            Add itinerary
          </GhostButton>
        }
        className="h-full justify-center py-6"
      />
    );
  }

  const memberById = new Map(bandMembers.map((m) => [m.id, m] as const));
  const chairsByPackageId = new Map<string, BookingBandChair[]>();
  const wholeDayChairs: BookingBandChair[] = [];
  for (const chair of bandChairs) {
    if (chair.packageId) {
      if (!chairsByPackageId.has(chair.packageId)) chairsByPackageId.set(chair.packageId, []);
      chairsByPackageId.get(chair.packageId)!.push(chair);
    } else {
      wholeDayChairs.push(chair);
    }
  }
  // A package header only appears where a set already leads its run — a package holding chairs
  // but no sets yet never gets one, so its roster renders in its own fallback block below instead.
  const rosterShownForPackageId = new Set<string>();
  const packagesMissingAHeader = packages.filter(
    (pkg) => chairsByPackageId.has(pkg.id) && !rows.some((row) => row.kind === 'set' && row.pkg?.id === pkg.id),
  );

  return (
    <Card
      title="Itinerary"
      action={
        <GhostButton variant="primary" size="xs" icon={<Pencil size={13} />} onClick={() => setSearchParams({ sheet: 'itineraryTweak' })}>
          Edit
        </GhostButton>
      }
    >
      <div>
        {rows.map((row, i) => {
          const showBorder = !!rows[i + 1] && rows[i + 1].group !== row.group;
          const timeCol = row.kind === 'time' ? row.time : (row.set.startTime ?? formatDuration(row.set.duration));
          const labelCol = row.kind === 'time' ? row.label : setLabel(row.set);
          const packageRoster =
            row.kind === 'set' && row.startsRun && row.pkg && chairsByPackageId.has(row.pkg.id) && !rosterShownForPackageId.has(row.pkg.id)
              ? chairsByPackageId.get(row.pkg.id)!
              : null;
          if (packageRoster && row.kind === 'set' && row.pkg) rosterShownForPackageId.add(row.pkg.id);
          return (
            <Fragment key={row.rowKey}>
              {/* Package name leads each contiguous run of its sets. */}
              {row.kind === 'set' && row.startsRun && row.pkg && (
                <div className="flex items-center gap-1.5 pb-1 pt-2 text-xs font-medium text-muted">
                  <FormatIcon icon={row.pkg.icon} size={14} />
                  {row.pkg.label}
                </div>
              )}
              {packageRoster && <PackageRoster chairs={packageRoster} memberById={memberById} />}
              <div
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
                {row.kind === 'time' && row.notes ? (
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground">{labelCol}</span>
                    <span className="text-xs text-muted">{row.notes}</span>
                  </div>
                ) : (
                  <span className="text-sm text-foreground">{labelCol}</span>
                )}
              </div>
            </Fragment>
          );
        })}

        {/* A package with chairs but no sets yet never leads a run above — its own header here. */}
        {packagesMissingAHeader.map((pkg) => (
          <Fragment key={pkg.id}>
            <div className="flex items-center gap-1.5 pb-1 pt-2 text-xs font-medium text-muted">
              <FormatIcon icon={pkg.icon} size={14} />
              {pkg.label}
            </div>
            <PackageRoster chairs={chairsByPackageId.get(pkg.id)!} memberById={memberById} />
          </Fragment>
        ))}

        {/* Chairs that play across the whole day, tied to no segment — still rendered, per ADR-0072
            §6, even for a package-less booking whose chairs are all "Whole day". */}
        {wholeDayChairs.length > 0 && (
          <>
            <div className="pb-1 pt-2 text-xs font-medium text-muted">{segmentLabel(wholeDayChairs[0], packages)}</div>
            <PackageRoster chairs={wholeDayChairs} memberById={memberById} />
          </>
        )}
      </div>
    </Card>
  );
}
