// Band members v1 (#879, ADR-0072 §5): the member lifecycle, declared once (CLAUDE.md's
// one-declaration rule). `BookingBandMember.status` stays a plain Prisma String per the #787
// String-over-enum convention — this array is the single source for DTO validation (`@IsIn`) and
// Swagger's `enum:` documentation, mirroring `CONTRACT_STATUSES` in portal-visibility.ts.
//
// `ADDED -> CONFIRMED` is a legal transition: confirming on someone's behalf must not fabricate an
// INVITED that never happened. Every reversal is organiser-only (ADR-0072 §5) and this slice has no
// portal actor yet (#880), so there is no transition graph to enforce here — any member of this
// list is a legal value for `status`.
export const BAND_MEMBER_STATUSES = ['ADDED', 'INVITED', 'CONFIRMED', 'DECLINED'] as const;

export type BandMemberStatus = (typeof BAND_MEMBER_STATUSES)[number];
