import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { setSelect, packageSelect } from '../bookings/bookings.repository';

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
const bandPortalVenueSelect = {
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
const bandPortalChairSelect = {
  id: true,
  role: true,
  lineupId: true,
  memberId: true,
  member: { select: { contact: { select: { name: true } } } },
} as const;

const bandPortalLineupSelect = {
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
