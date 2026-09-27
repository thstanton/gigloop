// Band members v1 (#879, ADR-0072 §5): the member lifecycle, declared once (CLAUDE.md's
// one-declaration rule). `BookingBandMember.status` stays a plain Prisma String per the #787
// String-over-enum convention — this array is the single source for DTO validation (`@IsIn`) and
// Swagger's `enum:` documentation, mirroring `CONTRACT_STATUSES` in portal-visibility.ts.
//
// `ADDED -> CONFIRMED` is a legal transition: confirming on someone's behalf must not fabricate an
// INVITED that never happened. The organiser's own PATCH (bookings.service.ts `updateBandMember`)
// stays unrestricted — every reversal is organiser-only (ADR-0072 §5), and a reversal is exactly a
// transition the organiser must be able to make from any status to any other.
export const BAND_MEMBER_STATUSES = ['ADDED', 'INVITED', 'CONFIRMED', 'DECLINED'] as const;

export type BandMemberStatus = (typeof BAND_MEMBER_STATUSES)[number];

// The roster's start state — a newly-added member, or (Copy Event, #889) one that's just been
// re-invited-by-implication onto a fresh booking. Derived, not hand-written, so it can never
// drift from the table above.
export const INITIAL_BAND_MEMBER_STATUS: BandMemberStatus = BAND_MEMBER_STATUSES[0];

// The dep's own one-shot portal response (#892, ADR-0074 §4): only a member who hasn't answered
// yet may respond. This is the one and only transition guard in the lifecycle — it gates the
// public-token `/band/:token/respond` route, never the organiser's PATCH above, so a leader can
// still flip a dep's answer back to ADDED/INVITED and have them "one-shot" respond again.
export function canRespondToBandInvite(status: BandMemberStatus): boolean {
  return status === 'ADDED' || status === 'INVITED';
}
