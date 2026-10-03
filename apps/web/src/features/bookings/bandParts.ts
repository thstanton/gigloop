import { LINEUP_SIZE_NAMES } from '@/lib/constants';
import type { BookingBandChair, BookingBandMember, BookingLineup, BookingPackageSummary } from '@/types/api';

// #987 / #983's resolution. The derivations the three Band cards share, declared once so the
// "one shape per object" rule cannot drift between the Lineups card, the Players card and Parts to
// fill — all three render the same part row from the same facts.
//
// Vocabulary note (#983): **"part" is the user-facing word**, `Chair` stays the model word. The
// API, the DTOs and these types are untouched; only the copy speaks "part".

/** 1 Solo · 2 Duo · 3 Trio · 4+ "{n}-piece" (ADR-0084 §2). Never "Band" — that names only the Band
 *  sheet and the band portal. */
export function lineupSizeName(partCount: number): string {
  if (partCount < 1) return 'No parts yet';
  return LINEUP_SIZE_NAMES.find((row) => row.parts === partCount)?.name ?? `${partCount}-piece`;
}

/** A Lineup's name; an unnamed one (a musician who added one part at a time, #884) reads as its size. */
export function lineupName(lineup: BookingLineup, chairs: BookingBandChair[]): string {
  return lineup.label ?? lineupSizeName(partsOf(lineup.id, chairs).length);
}

/**
 * #987 retired `chairPackageId`, which returned `packageIds[0]`. That was correct only while a
 * Lineup played at most one segment; the moment one plays two it silently reported the first and
 * decided, wrongly, which segment a part rendered under in the Itinerary (#983 flagged it).
 * A part plays every segment its band plays.
 */
export function chairPackageIds(chair: BookingBandChair, lineups: BookingLineup[]): string[] {
  return lineups.find((l) => l.id === chair.lineupId)?.packageIds ?? [];
}

export type PackageBandSummary =
  | { kind: 'you' }
  | { kind: 'allConfirmed' }
  | { kind: 'toFill'; count: number }
  | { kind: 'waiting'; count: number }
  | { kind: 'sameAs'; packageLabel: string };

export interface PackageBand {
  name: string;
  summary: PackageBandSummary;
  /** Empty when the lineup is shared with an earlier package — its parts are listed once, there. */
  parts: BookingBandChair[];
}

/**
 * #1056 (ADR-0084 §1–2): what the Itinerary says under a package header — which lineup plays it,
 * what is still to fill, and who holds each part. `null` for a package with no lineup ("Decide
 * later"), which shows no lineup line at all.
 *
 * A lineup shared by several packages lists its parts under the earliest of them (booking package
 * order); the others read "same as {that package}". "Still to fill" counts empty parts only — the
 * organiser's own row is CONFIRMED on seating (§7) and so never counts toward anything.
 */
export function packageBand(
  packageId: string,
  packages: BookingPackageSummary[],
  lineups: BookingLineup[],
  chairs: BookingBandChair[],
  members: Pick<BookingBandMember, 'id' | 'isSelf' | 'status'>[],
): PackageBand | null {
  const lineup = lineups.find((l) => l.packageIds.includes(packageId));
  if (!lineup) return null;
  const name = lineupName(lineup, chairs);

  const linked = packages.filter((p) => lineup.packageIds.includes(p.id)).sort((a, b) => a.order - b.order);
  const earliest = linked[0];
  if (earliest && earliest.id !== packageId) {
    return { name, summary: { kind: 'sameAs', packageLabel: earliest.label }, parts: [] };
  }

  const parts = partsOf(lineup.id, chairs);
  const memberOf = (chair: BookingBandChair) => members.find((m) => m.id === chair.memberId);
  const vacant = parts.filter((c) => c.memberId === null).length;
  const unconfirmed = parts.filter((c) => c.memberId !== null && memberOf(c)?.status !== 'CONFIRMED').length;

  let summary: PackageBandSummary;
  if (vacant > 0) summary = { kind: 'toFill', count: vacant };
  else if (parts.length === 1 && memberOf(parts[0])?.isSelf) summary = { kind: 'you' };
  else if (unconfirmed > 0) summary = { kind: 'waiting', count: unconfirmed };
  else summary = { kind: 'allConfirmed' };
  return { name, summary, parts };
}

/** Segment labels for a Lineup, in the booking's own package order rather than link order. */
export function lineupSegmentLabels(lineup: BookingLineup, packages: BookingPackageSummary[]): string[] {
  return packages.filter((p) => lineup.packageIds.includes(p.id)).map((p) => p.label);
}

/** "Drinks Reception", "Drinks Reception and Evening Party", "Drinks, Evening and Late Set". */
export function joinSegments(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export interface PlaysLine {
  text: string;
  /** #983 story state 7: a Lineup on a packaged booking that plays nothing reads in the warning tone. */
  warning: boolean;
}

/**
 * The "what a band plays" wording, owned once (one declaration per vocabulary) since it is needed
 * against two different shapes: a persisted Lineup's segment labels here, and a create-time
 * musician's declared choice against PackageTemplate labels (#989's `lineupChoices.ts`). The empty
 * link set is two different facts and the caller tells them apart (ADR-0081 §4) — on a booking (or
 * a create-time selection) with no packages there is one bucket and the band plays all of it; with
 * packages present it is a band parked with nothing to play yet.
 */
export function segmentsLine(labels: string[], hasPackages: boolean): PlaysLine {
  if (labels.length) {
    return { text: `Plays ${joinSegments(labels)}`, warning: false };
  }
  return hasPackages
    ? { text: 'Plays nothing yet', warning: true }
    : { text: 'Plays the whole gig', warning: false };
}

/** What a band plays, in one line, for a persisted Lineup. See `segmentsLine` for the wording. */
export function playsLine(
  lineup: BookingLineup,
  packages: BookingPackageSummary[],
): PlaysLine {
  return segmentsLine(lineupSegmentLabels(lineup, packages), packages.length > 0);
}

/**
 * What a part's call times read as: one "18:00 Drinks Reception" per segment the part's band plays
 * that has a timed set, in the booking's package order (the server derives and orders them).
 *
 * The package-less bucket carries no label, and — exactly as `segmentsLine` does two cards above —
 * the caller's `hasPackages` is what tells its two readings apart: on a booking with no packages
 * that bucket IS the whole gig and says so; on a booking with packages it is a band parked with
 * nothing to play yet, where naming a segment would be a lie, so the bare time stands alone.
 *
 * An empty result means no segment the band plays has a timed set — absent, not zero. PartRow says
 * "No call time" rather than showing a placeholder.
 */
export function callTimeParts(chair: BookingBandChair, hasPackages: boolean): string[] {
  return chair.callTimes.map(({ segmentLabel, startTime }) => {
    const label = segmentLabel ?? (hasPackages ? null : 'Whole gig');
    return label ? `${startTime} ${label}` : startTime;
  });
}

/** A band's parts, in seat order. `order` is per-Lineup (ADR-0081), never booking-wide. */
export function partsOf(lineupId: string, chairs: BookingBandChair[]): BookingBandChair[] {
  return chairs.filter((c) => c.lineupId === lineupId).sort((a, b) => a.order - b.order);
}

/** "7 parts · 2 still to fill" / "4 parts · all filled" — the reason to look at the Lineups card. */
export function partCountLine(parts: BookingBandChair[]): string {
  const vacant = parts.filter((c) => c.memberId === null).length;
  const noun = parts.length === 1 ? 'part' : 'parts';
  const fill = vacant ? `${vacant} still to fill` : 'all filled';
  return `${parts.length} ${noun} · ${fill}`;
}

/**
 * #983's suppression rule, in one place: a part row names its band **only** when the booking has
 * more than one. Four of the six story scenarios have exactly one, and showing the name there puts
 * it on the card title AND on every row beneath it — which is most of what read as blurry.
 * The same rule governs BandCard's vacancy badges, so the musician learns it once.
 */
export function shouldNameBand(lineups: BookingLineup[]): boolean {
  return lineups.length > 1;
}

/**
 * Who renders as a player: anyone holding at least one part, **or** the musician themself.
 *
 * `Players` is purely derived (#983) — someone leaves by coming out of every part, and their row
 * goes with the last one. `isSelf` is the deliberate exception: ADR-0072 §3 marks the musician on
 * the booking whether or not they fill a part, and `BandCard` has shown that all along.
 *
 * Declared here because BOTH surfaces must obey it. When only the sheet filtered, emptying
 * someone's last part made them vanish from the sheet while persisting on the Info tab as an
 * unlabelled chip — and with no per-person remove there was then no way to clear them anywhere.
 */
export function rendersAsPlayer(member: { id: string; isSelf: boolean }, chairs: BookingBandChair[]): boolean {
  return member.isSelf || chairs.some((c) => c.memberId === member.id);
}

/**
 * The Lineups an apply targeting `packageIds` would sweep away entirely — mirrors the server's
 * `displaceSegments`: a band is displaced when every segment it played was targeted, and on a
 * booking with no packages the single link-less bucket is what an empty target displaces.
 *
 * The apply path genuinely deletes chairs, members' seats and their confirmations, so the musician
 * has to be told before it happens. Journey ④ — which touches links only and destroys nothing —
 * already warns; without this, the *safe* operation warned and the destructive one did not.
 */
export function lineupsDisplacedBy(
  lineups: BookingLineup[],
  packages: BookingPackageSummary[],
  packageIds: string[],
): BookingLineup[] {
  if (!packageIds.length) {
    return packages.length ? [] : lineups.filter((l) => l.packageIds.length === 0);
  }
  return lineups.filter(
    (l) => l.packageIds.length > 0 && l.packageIds.every((id) => packageIds.includes(id)),
  );
}
