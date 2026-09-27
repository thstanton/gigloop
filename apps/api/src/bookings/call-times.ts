// Call-time derivation (ADR-0072 §2, re-pointed by ADR-0081 §3/§4, #987) — extracted from
// bookings.service.ts so the band portal mapper (#891) can compute the same derived call times
// the organiser sees, rather than re-deriving the same rule a second time. A stored copy drifts
// the first time a set moves, so both consumers read this module instead.
//
// Dependency-free (no NestJS, no Prisma) — a pure function file, matching portal-visibility.ts.

// One segment a chair is called to, and when (#983/#991). A part plays every segment its Lineup
// plays, so a chair called to two of them carries two entries — "18:00 Drinks Reception",
// "20:30 Evening Party" — not one collapsed earliest time. `segmentId`/`segmentLabel` are null for
// the package-less bucket, which the reader disambiguates the way `segmentsLine` does: on a
// booking with no packages it is the whole gig, on one with packages a Lineup parked with nothing
// to play yet (ADR-0081 §4).
export type ChairCallTime = {
  segmentId: string | null;
  segmentLabel: string | null;
  startTime: string;
};

/** "HH:mm" → minutes since midnight, or null when unset/unparseable. Mirrors ItineraryCard.tsx. */
function startMinutes(startTime: string | null): number | null {
  if (!startTime) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// Call times are derived, never stored (ADR-0072 §2): each segment's earliest
// PerformanceSet.startTime. A segment is a `packageId` — including `null`, which groups every
// package-less set into one segment, so a package-less booking's chairs get a call time too via
// the same lookup (one code path, no special case). A segment with no timed set has no entry, so
// its chairs' call time is absent (undefined → mapped to null), never zero or a placeholder.
export function deriveCallTimes(
  sets: Array<{ packageId: string | null; startTime: string | null }>,
): Map<string | null, string> {
  const earliest = new Map<string | null, { startTime: string; minutes: number }>();
  for (const set of sets) {
    const minutes = startMinutes(set.startTime);
    if (minutes == null || !set.startTime) continue;
    const current = earliest.get(set.packageId);
    if (!current || minutes < current.minutes) {
      earliest.set(set.packageId, { startTime: set.startTime, minutes });
    }
  }
  const result = new Map<string | null, string>();
  for (const [packageId, entry] of earliest) result.set(packageId, entry.startTime);
  return result;
}

// A package-less Lineup (`packageIds` empty) looks up the same `null`-keyed bucket a package-less
// chair used to — one code path, no special case (ADR-0081 §4). A segment with no timed set
// contributes no entry, so its absence stays absent rather than becoming zero or a placeholder.
export function segmentCallTimes(
  packageIds: string[],
  callTimesByPackage: Map<string | null, string>,
  packages: Array<{ id: string; label: string }>,
): ChairCallTime[] {
  if (packageIds.length === 0) {
    const startTime = callTimesByPackage.get(null);
    return startTime ? [{ segmentId: null, segmentLabel: null, startTime }] : [];
  }
  const played = packages.filter((pkg) => packageIds.includes(pkg.id));
  const entries: ChairCallTime[] = [];
  for (const pkg of played) {
    const startTime = callTimesByPackage.get(pkg.id);
    if (startTime != null) entries.push({ segmentId: pkg.id, segmentLabel: pkg.label, startTime });
  }
  return entries;
}

// A Lineup's call times: one per segment it plays that has a timed set (ADR-0081 §4), in the
// **booking's** package order — not link order — so the row reads in the order of the day and
// matches what `playsLine` says two cards above it. #987 lets a Lineup play several segments, and
// #983's design shows every one of them: collapsing them to the earliest lost the reader the fact
// that the band is called twice.
export function deriveLineupCallTimes(
  lineups: Array<{ id: string; packageIds: string[] }>,
  callTimesByPackage: Map<string | null, string>,
  packages: Array<{ id: string; label: string }>,
): Map<string, ChairCallTime[]> {
  const result = new Map<string, ChairCallTime[]>();
  for (const lineup of lineups) {
    result.set(lineup.id, segmentCallTimes(lineup.packageIds, callTimesByPackage, packages));
  }
  return result;
}
