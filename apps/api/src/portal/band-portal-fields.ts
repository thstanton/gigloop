// The band portal's declared field projection (#891, ADR-0073 §1/§2). A dep who opens
// `/band/:token` sees the whole gig day, but only through this table — never a spread of the
// booking, its chairs or its members. Private by default: a field added to `Booking` (or to a
// chair/member row) is invisible to the band until someone adds a row here and states why (the
// #805 lesson made structural).
//
// `roster` = what every dep sees about everyone on the gig. `self` = what the token's own member
// sees about themselves. The decisive structural guarantee lives in `BandPortalMapperInput`, not
// just in this table: `sessionFee` and `status` are typed only on `self`, never on a roster chair,
// so the mapper has no path from a roster row to another member's fee or status regardless of what
// this table says — the caller (`band-portal.repository.ts`) must never select another member's
// fee/status/token in the first place. Branding (the musician's business identity) is deliberately
// NOT a row here: it is baseline portal chrome, always returned regardless of the cancelled gate,
// exactly as the client portal always returns `publicProfile` (portal.service.ts).
//
// This module is dependency-free (no NestJS, no Prisma) — a pure function file, matching
// portal-visibility.ts. It is imported by band-portal.service.ts and unit-tested directly here.

import { deriveCallTimes, deriveLineupCallTimes, type ChairCallTime } from '../bookings/call-times';
import type { BandMemberStatus } from '../bookings/band-member-status';

export type BandFieldScope = 'roster' | 'self';

export interface BandPortalRunningOrderSet {
  order: number;
  label: string | null;
  startTime: string | null;
  duration: number;
  packageId: string | null;
}

export interface BandPortalSegment {
  id: string;
  label: string;
  icon: string;
  order: number;
}

// A seat in the roster (ADR-0072 §2, ADR-0073 §2). `memberName` is null for a vacant chair — vacant
// chairs cross role-only, never a placeholder name. `id` is the chair's own id (needed for React
// keys and for `self.ownChairIds` to reference), never the filling member's id — a roster row names
// nobody's identifier, only their name.
export interface BandPortalRosterChair {
  id: string;
  role: string;
  memberName: string | null;
  callTimes: ChairCallTime[];
}

// One `shareWithBand` logistics entry (ADR-0072 §4, ADR-0073 §2) — `key` lets the frontend look up
// its label from the existing `LOGISTICS_FIELD_LABELS` map (apps/web/src/lib/constants.ts) rather
// than this module re-declaring labels the web app already owns.
export interface BandPortalLogisticsEntry {
  key: string;
  value: string;
}

export interface BandPortalVenueAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
}

export interface BandPortalRosterView {
  bookingTitle: string | null;
  bookingDate: string;
  venueName: string | null;
  venueAddress: BandPortalVenueAddress | null;
  sets: BandPortalRunningOrderSet[];
  segments: BandPortalSegment[];
  chairs: BandPortalRosterChair[];
  logistics: BandPortalLogisticsEntry[];
}

// What the token's own member sees about themselves (ADR-0073 §2). `sessionFee` here is the ONLY
// place a fee can reach the wire — no roster field carries one, for any member.
export interface BandPortalSelfView {
  status: BandMemberStatus;
  sessionFee: string | null;
  /** This member's own chair ids, for portal highlighting — never a member/contact id. */
  ownChairIds: string[];
}

export interface BandPortalView {
  roster: BandPortalRosterView;
  self: BandPortalSelfView;
}

export interface BandPortalFieldRow {
  key: string;
  scope: BandFieldScope;
}

const ROSTER_FIELD_KEYS = [
  'bookingTitle',
  'bookingDate',
  'venueName',
  'venueAddress',
  'sets',
  'segments',
  'chairs',
  'logistics',
] as const satisfies readonly (keyof BandPortalRosterView)[];

const SELF_FIELD_KEYS = [
  'status',
  'sessionFee',
  'ownChairIds',
] as const satisfies readonly (keyof BandPortalSelfView)[];

// Compile-time coverage, both directions, per scope (CLAUDE.md's one-declaration-per-vocabulary
// rule, applied to a field wall rather than an enum): a view key missing from its scope's key list,
// or a key list naming something the view doesn't have, fails to typecheck. `AssertNever` only
// typechecks when its argument resolves to `never` — see portal-visibility.ts's `isBandAudience`
// for the same never-based exhaustiveness idiom applied to a switch instead of a key set.
type AssertNever<T extends never> = T;
type _RosterFieldsCoverage = AssertNever<Exclude<keyof BandPortalRosterView, (typeof ROSTER_FIELD_KEYS)[number]>>;
type _RosterFieldsNoExtraRows = AssertNever<Exclude<(typeof ROSTER_FIELD_KEYS)[number], keyof BandPortalRosterView>>;
type _SelfFieldsCoverage = AssertNever<Exclude<keyof BandPortalSelfView, (typeof SELF_FIELD_KEYS)[number]>>;
type _SelfFieldsNoExtraRows = AssertNever<Exclude<(typeof SELF_FIELD_KEYS)[number], keyof BandPortalSelfView>>;

// The declared table itself (ADR-0073 §1) — one row per crossing field, scope-tagged. Derived from
// the two guarded key lists above rather than hand-restated, so this array and the coverage checks
// can never independently drift from each other.
export const BAND_PORTAL_FIELDS: readonly BandPortalFieldRow[] = [
  ...ROSTER_FIELD_KEYS.map((key): BandPortalFieldRow => ({ key, scope: 'roster' })),
  ...SELF_FIELD_KEYS.map((key): BandPortalFieldRow => ({ key, scope: 'self' })),
];

// A local mirror of the *static, per-field-type* `LOGISTICS_FIELDS.shareWithBand` column
// (apps/web/src/lib/constants.ts) — deliberately NOT `BookingLogisticsEntry.shareWithBand`, the
// other, per-entry flag on the same name. That flag is organiser-toggled on the live value and, per
// its own doc comment in constants.ts, "currently always `false` with no UI to set it" — filtering
// on it would cross nothing at all, not even arrival time. The API can't import the frontend's
// table (no shared package exists between the two workspaces — the same boundary
// `DocumentTypeValue` crosses in portal-visibility.ts), so this is a disclosed second declaration,
// not an oversight. `dressCode` is deliberately absent — the client's dress-code spec doesn't cross,
// only the leader's own `outfits` implementation of it (ADR-0072 §4). Order here is the display
// order on the portal.
const BAND_SHARED_LOGISTICS_KEYS = [
  'arrivalTime',
  'soundCheckTime',
  'finishTime',
  'performanceSpace',
  'foodProvided',
  'greenRoom',
  'equipmentRequired',
  'travelPlan',
  'outfits',
] as const;

export interface BandPortalMapperInput {
  booking: {
    title: string | null;
    date: Date;
    logistics: unknown;
  };
  venue: {
    name: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    county: string | null;
    postcode: string | null;
    country: string | null;
  } | null;
  sets: BandPortalRunningOrderSet[];
  packages: BandPortalSegment[];
  lineups: Array<{ id: string; packageIds: string[] }>;
  // Deliberately narrow: no `sessionFee`, no `status`, no `bandPortalToken`, for any chair's
  // member — the fee/status/token wall is enforced by this type, not just by the table above. A
  // future field added here for "everyone" convenience is exactly the leak #891 exists to prevent.
  chairs: Array<{
    id: string;
    role: string;
    lineupId: string;
    memberId: string | null;
    memberName: string | null;
  }>;
  // The token's own member — the only source `self.sessionFee`/`self.status` may ever read from.
  self: {
    memberId: string;
    status: BandMemberStatus;
    sessionFee: string | null;
  };
}

function buildVenueAddress(venue: BandPortalMapperInput['venue']): BandPortalVenueAddress | null {
  if (!venue) return null;
  return {
    line1: venue.addressLine1,
    line2: venue.addressLine2,
    city: venue.city,
    county: venue.county,
    postcode: venue.postcode,
    country: venue.country,
  };
}

function buildRosterChairs(
  chairs: BandPortalMapperInput['chairs'],
  callTimesByLineup: Map<string, ChairCallTime[]>,
): BandPortalRosterChair[] {
  return chairs.map((chair) => ({
    id: chair.id,
    role: chair.role,
    memberName: chair.memberName,
    callTimes: callTimesByLineup.get(chair.lineupId) ?? [],
  }));
}

function buildBandLogistics(raw: unknown): BandPortalLogisticsEntry[] {
  if (!raw || typeof raw !== 'object') return [];
  const map = raw as Record<string, { value?: unknown } | undefined>;
  const entries: BandPortalLogisticsEntry[] = [];
  for (const key of BAND_SHARED_LOGISTICS_KEYS) {
    const value = map[key]?.value;
    if (typeof value === 'string' && value.trim() !== '') entries.push({ key, value });
  }
  return entries;
}

function buildOwnChairIds(chairs: BandPortalMapperInput['chairs'], selfMemberId: string): string[] {
  return chairs.filter((chair) => chair.memberId === selfMemberId).map((chair) => chair.id);
}

// The field-by-field mapper (ADR-0073 §1) — every output key is assigned individually below. No
// `...` spread anywhere, so a field silently added to `BandPortalMapperInput`'s shape (or to a
// Prisma select feeding it) cannot cross just by existing on the input object.
export function mapBandPortalView(input: BandPortalMapperInput): BandPortalView {
  const callTimesByPackage = deriveCallTimes(input.sets);
  const callTimesByLineup = deriveLineupCallTimes(input.lineups, callTimesByPackage, input.packages);

  return {
    roster: {
      bookingTitle: input.booking.title,
      bookingDate: input.booking.date.toISOString(),
      venueName: input.venue?.name ?? null,
      venueAddress: buildVenueAddress(input.venue),
      sets: input.sets.map((s) => ({
        order: s.order,
        label: s.label,
        startTime: s.startTime,
        duration: s.duration,
        packageId: s.packageId,
      })),
      segments: input.packages.map((p) => ({ id: p.id, label: p.label, icon: p.icon, order: p.order })),
      chairs: buildRosterChairs(input.chairs, callTimesByLineup),
      logistics: buildBandLogistics(input.booking.logistics),
    },
    self: {
      status: input.self.status,
      sessionFee: input.self.sessionFee,
      ownChairIds: buildOwnChairIds(input.chairs, input.self.memberId),
    },
  };
}
