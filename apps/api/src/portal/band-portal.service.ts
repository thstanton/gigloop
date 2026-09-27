import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BandPortalRepository } from './band-portal.repository';
import { PublicProfileRepository } from '../user-profile/public-profile.repository';
import { PORTAL_CONFIG_DEFAULTS } from './portal.service';
import { mapBandPortalView, type BandPortalRosterView, type BandPortalSelfView } from './band-portal-fields';
import { canRespondToBandInvite, type BandMemberStatus } from '../bookings/band-member-status';
import type { BandResponseValue } from './dto/band-respond.dto';
import { DocumentsService } from '../documents/documents.service';

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
    private documents: DocumentsService,
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

  // The dep's one-shot answer (#892, ADR-0074 §4). The guard is server-side, not merely a hidden
  // client button: a second attempt — replay, double tap, a stale open tab — is rejected here
  // regardless of what the frontend has already stopped rendering. Reversal is never available on
  // this path; only the organiser's own PATCH (bookings.service.ts `updateBandMember`) can move a
  // member back out of CONFIRMED/DECLINED, which is what re-opens this guard for a second attempt.
  async respondToInvite(token: string, response: BandResponseValue): Promise<BandPortalData> {
    const member = await this.repo.findMemberByToken(token);
    if (!member) throw new NotFoundException('Band member not found');

    if (!canRespondToBandInvite(member.status as BandMemberStatus)) {
      throw new BadRequestException('This invite has already been answered');
    }

    const booking = await this.repo.findBookingForBandPortal(member.bookingId);
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('This booking has been cancelled');
    }

    // The atomic guard (repo's `updateMany` with a status `where`, not just the read-then-check
    // above) is what actually makes this one-shot under concurrency: a racing second call updates
    // 0 rows and is reported here exactly as a genuinely sequential second attempt would be.
    const responded = await this.repo.respondToInvite(member.id, response);
    if (!responded) throw new BadRequestException('This invite has already been answered');

    return this.getBandPortalData(token);
  }

  // The call-sheet download (#893, ADR-0073 §4) — generated on demand, unstored, no `Document` row
  // (that's `DocumentsService.generateAndStoreCallSheetPdf`'s job, on send, #881). Gated the same
  // way as the roster itself: `findMemberByToken`'s `removedAt: null` only, no status check — any
  // non-removed member may download regardless of ADDED/INVITED/CONFIRMED/DECLINED, because an
  // INVITED dep deciding whether to take the gig is exactly who needs it. A cancelled booking
  // suppresses the whole band portal (ADR-0073 §5), the call sheet included.
  async getCallSheetPdfBuffer(token: string): Promise<Buffer> {
    const member = await this.repo.findMemberByToken(token);
    if (!member) throw new NotFoundException('Band member not found');

    const booking = await this.repo.findBookingForBandPortal(member.bookingId);
    if (!booking || booking.status === 'CANCELLED') throw new NotFoundException('Booking not found');

    return this.documents.generateCallSheetPdfBuffer(booking.userId, member.bookingId);
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
