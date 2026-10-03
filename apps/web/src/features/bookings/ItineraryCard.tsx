import { Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Pencil, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import FormatIcon from './FormatIcon';
import { chairPackageIds, packageBand } from './bandParts';
import type { PackageBand, PackageBandSummary } from './bandParts';
import { LOGISTICS_FIELD_ICONS } from '@/lib/constants';
import type { BookingBandChair, BookingBandMember, BookingLineup, BookingLogisticsEntry, BookingPackageSummary, PerformanceSet } from '@/types/api';

type TimelineRow =
  | { kind: 'time'; rowKey: string; label: string; time: string; notes?: string; group: string }
  | { kind: 'set'; rowKey: string; set: PerformanceSet; group: string; pkg: BookingPackageSummary | null; startsRun: boolean };

interface ItineraryCardProps {
  logistics: Record<string, BookingLogisticsEntry> | null;
  sets: PerformanceSet[];
  packages: BookingPackageSummary[];
  hideWhenEmpty?: boolean;
  /** The band roster (#887, ADR-0072 §6; re-pointed by ADR-0081) — rendered inline under each
   *  package header, read-only. Presentational: this card issues no fetch of its own, so the host
   *  passes `[]` when the band members flag is off, which keeps the roster absent with no other
   *  branching here. */
  bandLineups?: BookingLineup[];
  bandChairs?: BookingBandChair[];
  bandMembers?: BookingBandMember[];
}

/** The muted "{lineup} · {summary}" under a package label (ADR-0084 §2). Only "still to fill" is
 *  emphasised; the rest is one text run. */
function bandSummaryText(summary: PackageBandSummary): { text: string; emphasised: boolean } {
  switch (summary.kind) {
    case 'you': return { text: 'you', emphasised: false };
    case 'allConfirmed': return { text: 'all confirmed', emphasised: false };
    case 'waiting': return { text: `${summary.count} waiting`, emphasised: false };
    case 'sameAs': return { text: `same as ${summary.packageLabel}`, emphasised: false };
    case 'toFill': return { text: `${summary.count} still to fill`, emphasised: true };
  }
}

function PackageHeader({ pkg, band }: { pkg: BookingPackageSummary; band: PackageBand | null }) {
  const summary = band ? bandSummaryText(band.summary) : null;
  // No lineup (band flag off, or "Decide later") keeps the header exactly as it was before #1056.
  if (!band || !summary) {
    return (
      <div className="flex items-center gap-1.5 pb-1 pt-2 text-xs font-medium text-muted">
        <FormatIcon icon={pkg.icon} size={14} />
        {pkg.label}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 pb-1 pt-2 text-xs">
      <FormatIcon icon={pkg.icon} size={14} />
      <span className="font-semibold text-foreground">{pkg.label}</span>
      {/* Only the emphasised summary gets its own span, so the unemphasised line stays one text run. */}
      <span className="text-muted">
        {summary.emphasised ? `${band.name} · ` : `${band.name} · ${summary.text}`}
        {summary.emphasised && <span className="font-medium text-status-provisional">{summary.text}</span>}
      </span>
    </div>
  );
}

function partHolderText(member: BookingBandMember | undefined): string {
  if (!member) return 'Needs a player';
  if (member.isSelf) return 'You';
  return member.status === 'CONFIRMED' ? member.contact.name : `${member.contact.name} · waiting`;
}

/** One row per part: role (muted, fixed column), then who holds it. No call times, no click — this
 *  surface only answers "who plays what" (ADR-0084 §1–2). */
function PartRows({
  chairs,
  memberById,
}: {
  chairs: BookingBandChair[];
  memberById: Map<string, BookingBandMember>;
}) {
  if (chairs.length === 0) return null;
  const sorted = [...chairs].sort((a, b) => a.order - b.order);
  return (
    <div className="mb-2 flex flex-col gap-1">
      {sorted.map((chair) => {
        const member = chair.memberId ? memberById.get(chair.memberId) : undefined;
        const confirmed = member?.status === 'CONFIRMED';
        return (
          <div key={chair.id} className="flex gap-3 text-xs">
            <span className="w-20 flex-shrink-0 truncate text-muted">{chair.role}</span>
            <span
              className={cn(
                'min-w-0 flex-1 truncate',
                !member && 'font-medium text-status-provisional',
                member && !confirmed && 'italic text-muted',
                confirmed && 'text-foreground',
              )}
            >
              {partHolderText(member)}
            </span>
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
  bandLineups = [],
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
  const bandByPackageId = new Map(
    packages.map((pkg) => [pkg.id, packageBand(pkg.id, packages, bandLineups, bandChairs, bandMembers)] as const),
  );
  // Parts whose lineup plays no package: on a booking with no packages that is the whole gig,
  // listed once above the sets; on one with packages it is a band with nothing to play yet.
  const unlinkedChairs = bandChairs.filter((chair) => chairPackageIds(chair, bandLineups).length === 0);
  const unlinkedAboveSets = packages.length === 0;
  let unlinkedShown = false;
  // A package header only appears where a set already leads its run — a package with a lineup but
  // no sets yet never gets one, so it renders in its own fallback block below instead.
  const headerShownForPackageId = new Set<string>();
  const packagesMissingAHeader = packages.filter(
    (pkg) => bandByPackageId.get(pkg.id) && !rows.some((row) => row.kind === 'set' && row.pkg?.id === pkg.id),
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
          // Package name leads each contiguous run of its sets; the lineup line and its parts
          // appear once, under the first run, before that package's sets.
          const runPkg = row.kind === 'set' && row.startsRun ? row.pkg : null;
          const firstRun = !!runPkg && !headerShownForPackageId.has(runPkg.id);
          if (runPkg) headerShownForPackageId.add(runPkg.id);
          const band = runPkg && firstRun ? (bandByPackageId.get(runPkg.id) ?? null) : null;
          const showUnlinked = row.kind === 'set' && unlinkedAboveSets && !unlinkedShown && unlinkedChairs.length > 0;
          if (showUnlinked) unlinkedShown = true;
          return (
            <Fragment key={row.rowKey}>
              {showUnlinked && <PartRows chairs={unlinkedChairs} memberById={memberById} />}
              {runPkg && <PackageHeader pkg={runPkg} band={band} />}
              {band && <PartRows chairs={band.parts} memberById={memberById} />}
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

        {/* A package with a lineup but no sets yet never leads a run above — its own header here. */}
        {packagesMissingAHeader.map((pkg) => {
          const band = bandByPackageId.get(pkg.id) ?? null;
          return (
            <Fragment key={pkg.id}>
              <PackageHeader pkg={pkg} band={band} />
              {band && <PartRows chairs={band.parts} memberById={memberById} />}
            </Fragment>
          );
        })}

        {/* Parts of a lineup that plays nothing — still rendered (ADR-0072 §6). With no packages they
            sit above the sets instead (or here, if there are no sets at all). */}
        {unlinkedChairs.length > 0 && (unlinkedAboveSets ? !unlinkedShown : true) && (
          <>
            {!unlinkedAboveSets && <div className="pb-1 pt-2 text-xs font-medium text-muted">Not playing a set yet</div>}
            <PartRows chairs={unlinkedChairs} memberById={memberById} />
          </>
        )}
      </div>
    </Card>
  );
}
