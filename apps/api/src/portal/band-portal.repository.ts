import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { setSelect, packageSelect } from '../bookings/bookings.repository';
import { BAND_MEMBER_STATUSES, canRespondToBandInvite, type BandMemberStatus } from '../bookings/band-member-status';

// Every status a respondable member could be in, derived from the vocabulary rather than
// hand-listing ADDED/INVITED again (CLAUDE.md's one-declaration rule) — used as the atomic
// update's status guard below.
const RESPONDABLE_STATUSES = BAND_MEMBER_STATUSES.filter(canRespondToBandInvite);

// The band portal's own narrow selects (#891, ADR-0073) — deliberately NOT `bandChairSelect` /
// `bandMemberSelect` / `NESTED_CONTACT_SELECT` from bookings.repository.ts / booking.includes.ts.
// Those serve the *organiser* read path and carry fields the band must never see (a chair's
// `memberId`, every member's `sessionFee`/`status`/`bandPortalToken`, a venue's `parkingInfo`).
// Narrowing at the query — not trusting the mapper alone to drop them — is defence in depth
// alongside band-portal-fields.ts's field-by-field mapper.

// The token's own member row — the ONLY query in this module allowed to select `sessionFee` or
// `status`, and only for the one row matching the token. `removedAt: null` makes an unknown or
// removed token's link 404 identically (ADR-0072 §5): the service treats both as "not found".
export const bandPortalMemberSelect = {
  id: true,
  bookingId: true,
  status: true,
  sessionFee: true,
} as const;

// Name and structured address only — never `parkingInfo`/`accessInfo`/`notes`/`equipmentAvailable`,
// which are organiser-curated CRM fields the leader shares via `shareWithBand` logistics instead
// (ADR-0073 §2).
// Exported (#893): the call-sheet PDF builder (`documents.service.ts`) fetches its own
// userId-scoped booking read and reuses these same selects rather than re-declaring them, so the
// two consumers of `BAND_PORTAL_FIELDS` (the portal and the call sheet) can never drift on *input*
// shape either.
export const bandPortalVenueSelect = {
  name: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  county: true,
  postcode: true,
  country: true,
} as const;

// One seat, with just enough to build a roster row and derive its call times (ADR-0072 §2,
// ADR-0081 §3). No `sessionFee`, no `status`, no `bandPortalToken` — those live only on
// `bandPortalMemberSelect`, fetched by token. `memberId` is selected for `ownChairIds` matching in
// the mapper but is never itself part of a `BandPortalRosterChair` (band-portal-fields.ts).
export const bandPortalChairSelect = {
  id: true,
  role: true,
  lineupId: true,
  memberId: true,
  member: { select: { contact: { select: { name: true } } } },
} as const;

export const bandPortalLineupSelect = {
  id: true,
  packages: { select: { packageId: true } },
} as const;

@Injectable()
export class BandPortalRepository {
  constructor(private prisma: PrismaService) {}

  findMemberByToken(token: string) {
    return this.prisma.bookingBandMember.findFirst({
      where: { bandPortalToken: token, removedAt: null },
      select: bandPortalMemberSelect,
    });
  }

  // The dep's one-shot response (#892). `service.respondToInvite` proves the token and derives its
  // booking/tenant before calling this scoped transaction. The status guard in the write (not just
  // the service's read-then-check) makes the answer atomic; the requested chair clearing is in the
  // same transaction so the booking is never left half-mutated.
  async respondToInvite(
    userId: string,
    bookingId: string,
    memberId: string,
    status: BandMemberStatus,
    clearChairs: boolean,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.bookingBandMember.updateMany({
        where: { id: memberId, bookingId, userId, status: { in: RESPONDABLE_STATUSES } },
        data: { status, respondedAt: new Date() },
      });
      if (count === 0) return false;
      if (clearChairs) {
        await tx.bookingBandChair.updateMany({
          where: { memberId, bookingId, userId },
          data: { memberId: null },
        });
      }
      return true;
    });
  }

  findBookingForBandPortal(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        title: true,
        date: true,
        status: true,
        logistics: true,
        userId: true,
        venue: { select: bandPortalVenueSelect },
        sets: { select: setSelect, orderBy: { order: 'asc' } },
        packages: { select: packageSelect, orderBy: { order: 'asc' } },
        lineups: { select: bandPortalLineupSelect, orderBy: { createdAt: 'asc' } },
        bandChairs: {
          select: bandPortalChairSelect,
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }
}
