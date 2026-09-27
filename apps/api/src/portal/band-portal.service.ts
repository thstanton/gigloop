import { Injectable, NotFoundException } from '@nestjs/common';
import { BandPortalRepository } from './band-portal.repository';
import { PublicProfileRepository } from '../user-profile/public-profile.repository';
import { PORTAL_CONFIG_DEFAULTS } from './portal.service';
import { mapBandPortalView, type BandPortalRosterView, type BandPortalSelfView } from './band-portal-fields';

// The musician's business identity — baseline portal chrome, always returned regardless of the
// cancelled gate below (ADR-0073 §5's "identity and a banner"), exactly as the client portal always
// returns `publicProfile` regardless of any concern-visibility verdict (portal.service.ts). Not a
// `BAND_PORTAL_FIELDS` row: it isn't a privacy-sensitive booking concern, it's the same business
// identity the client portal already shows publicly. `email`/`phone` are shown unconditionally — the
// client portal's `showContactEmail`/`showContactPhone` toggles are `clientPortalConfig`, scoped to
// that audience by name (CONTEXT.md); a dep always needs a way to reach the leader (ADR-0073 §2).
export interface BandPortalBranding {
  businessName: string;
  displayName: string | null;
  logoUrl: string | null;
  brandColour: string;
  portalTheme: string;
  email: string | null;
  phone: string | null;
}

// A cancelled booking renders identity and a banner band-side, everything else suppressed
// (ADR-0073 §5) — modelled as a discriminated union so the suppressed fields are structurally
// absent from the response, not merely hidden by the frontend. The link stays live (no 404); only
// an unknown/removed token 404s (removeMember's soft-removal, ADR-0072 §5).
export type BandPortalData =
  | { cancelled: true; branding: BandPortalBranding }
  | { cancelled: false; branding: BandPortalBranding; roster: BandPortalRosterView; self: BandPortalSelfView };

@Injectable()
export class BandPortalService {
  constructor(
    private repo: BandPortalRepository,
    private publicProfileRepo: PublicProfileRepository,
  ) {}

  async getBandPortalData(token: string): Promise<BandPortalData> {
    const member = await this.repo.findMemberByToken(token);
    if (!member) throw new NotFoundException('Band member not found');

    const booking = await this.repo.findBookingForBandPortal(member.bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    const publicProfile = await this.publicProfileRepo.findByUserId(booking.userId);
    if (!publicProfile) throw new NotFoundException('Booking not found');

    const branding = this.buildBranding(publicProfile);

    if (booking.status === 'CANCELLED') return { cancelled: true, branding };

    const view = mapBandPortalView({
      booking: { title: booking.title, date: booking.date, logistics: booking.logistics },
      venue: booking.venue,
      sets: booking.sets,
      packages: booking.packages,
      lineups: booking.lineups.map((lineup) => ({
        id: lineup.id,
        packageIds: lineup.packages.map((p) => p.packageId),
      })),
      chairs: booking.bandChairs.map((chair) => ({
        id: chair.id,
        role: chair.role,
        lineupId: chair.lineupId,
        memberId: chair.memberId,
        memberName: chair.member?.contact.name ?? null,
      })),
      self: { memberId: member.id, status: member.status as BandPortalSelfView['status'], sessionFee: this.formatFee(member.sessionFee) },
    });

    return { cancelled: false, branding, roster: view.roster, self: view.self };
  }

  private buildBranding(profile: {
    businessName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    logoUrl: string | null;
    // Opaque JSON column — same shape portal.service.ts's `buildPortalPublicProfile` reads.
    clientPortalConfig: unknown;
  }): BandPortalBranding {
    const cfg = (profile.clientPortalConfig as { theme?: string; brandColour?: string } | null) ?? {};
    return {
      businessName: profile.businessName,
      displayName: profile.displayName,
      logoUrl: profile.logoUrl,
      brandColour: cfg.brandColour ?? PORTAL_CONFIG_DEFAULTS.brandColour,
      portalTheme: cfg.theme ?? PORTAL_CONFIG_DEFAULTS.theme,
      email: profile.email,
      phone: profile.phone,
    };
  }

  // Prisma `Decimal` serialises as a string over JSON (matches BookingBandMemberDto's convention).
  private formatFee(fee: unknown): string | null {
    return fee != null ? Number(fee).toFixed(2) : null;
  }
}
