import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { ContactResponseDto } from '../../contacts/dto/contact-response.dto';
import { EVENT_TYPES } from '../../common/constants';
import {
  CONTRACT_STATUSES,
  PORTAL_VISIBILITY_REASONS,
  type ContractStatus,
  type PortalVisibilityReason,
} from '../../portal/portal-visibility';

// The wire shape of a single booking as returned by `BookingsService.findOne` — the source of
// truth for everything below (`mapBooking` produces the same shape for the package endpoints).
// Nothing ties this file to that method at compile time: `findOne` spreads a Prisma row and
// `mapBooking` takes `any`, so there is no return type to `satisfies`-check against. **Update
// this DTO whenever the `findOne` return changes** (#786).
//
// Mirrors `BookingDetail` in apps/web/src/types/api.ts, with two deliberate differences:
//   • `userId` is omitted, exactly as `ContactResponseDto` omits it. The tenancy id *is* currently
//     on the wire (the repository uses `include`, not `select`, so every scalar is returned) —
//     documenting it would enshrine an over-fetch as contract. Tracked separately, see #805.
//   • Prisma `Decimal` is documented as `string` and `DateTime` as an ISO `string`, per the
//     shared-types convention.
//
// Two decorator traps this file deliberately avoids, both of which produce *wrong* docs silently:
//   • A `string | null` property needs an explicit `type: String`. The reflected design-type of a
//     union is `Object`, so `{ nullable: true }` alone documents the field as `type: object`.
//   • Nullable is not optional. Every field here is always a key in the JSON (the repository uses
//     `include`, so Prisma returns every scalar) — so they take `@ApiProperty`, not
//     `@ApiPropertyOptional`, which would mark them `required: false`. The single genuinely
//     optional property is a verdict's `reason`, which the resolvers omit entirely when visible.

export class PortalVisibilityVerdictDto {
  @ApiProperty({ description: 'Whether the client can currently see this concern on the portal' })
  visible: boolean;

  // Enum and type both derive from the one declaration in portal-visibility.ts, so Scalar can
  // never drift from what the resolvers emit (the #750 pattern). The booking surface keeps the
  // full five-member union: `resolveContractVisibility` emits `until_sent` / `voided` /
  // `cancelled` and `resolveMusicFormVisibility` emits `until_published`. `not_shared` is
  // document-only today — it stays in the union because the union is the vocabulary, not a
  // per-surface reachability list (see the note on `DocumentPortalVisibilityReason`).
  @ApiPropertyOptional({
    enum: [...PORTAL_VISIBILITY_REASONS],
    description: 'When hidden, the portal gate holding this concern back; absent when visible.',
  })
  reason?: PortalVisibilityReason;
}

// ADR-0054 / #578: the per-concern verdicts for the admin portal-visibility indicator, computed by
// the same authority the portal renderer reads. A null verdict means the concern is not a live
// portal concern at all (no contract created yet / music form switched off) — the frontend then
// renders no indicator rather than a "hidden" one.
export class BookingPortalVisibilityDto {
  @ApiProperty({
    type: PortalVisibilityVerdictDto,
    nullable: true,
    description: 'Contract concern; null when the booking has no contract yet.',
  })
  contract: PortalVisibilityVerdictDto | null;

  @ApiProperty({
    type: PortalVisibilityVerdictDto,
    nullable: true,
    description: 'Music-form concern; null when the music form is switched off for this booking.',
  })
  musicForm: PortalVisibilityVerdictDto | null;
}

// The booking's most recent contract, normalised by `BookingsService.normaliseContract` (dates to
// ISO strings). Only the latest is returned — superseded/void contracts are not in this payload.
export class BookingActiveContractDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) createdAt: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) updatedAt: string;

  @ApiProperty({ enum: [...CONTRACT_STATUSES] }) status: ContractStatus;

  @ApiProperty({
    type: Object,
    description: 'Tiptap JSON document — the contract body. Opaque to the API.',
  })
  content: unknown;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'ISO 8601 timestamp of signature; null until signed.',
  })
  signedAt: string | null;
}

export class BookingPerformanceSetDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) createdAt: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) updatedAt: string;
  @ApiProperty() bookingId: string;

  @ApiProperty({ description: 'Position within the booking itinerary (ascending).' }) order: number;
  @ApiProperty({ description: 'Length in minutes.' }) duration: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Wall-clock start time (HH:mm); null when the set is duration-only.',
  })
  startTime: string | null;

  @ApiProperty({ nullable: true, type: String }) label: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Owning booking-level Package; null for an ungrouped set.',
  })
  packageId: string | null;
}

// A booking-owned Package — the snapshot created when a PackageTemplate is applied. It is
// independent of its source template from that moment on.
export class BookingPackageDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) createdAt: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) updatedAt: string;
  @ApiProperty() bookingId: string;

  @ApiProperty() label: string;
  @ApiProperty({ description: 'Lucide icon name.' }) icon: string;
  @ApiProperty({ description: 'Position within the booking itinerary (ascending).' }) order: number;
}

export class BookingSeriesRefDto {
  @ApiProperty() id: string;
  @ApiProperty() label: string;
}

export class BookingResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) createdAt: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) updatedAt: string;

  @ApiProperty({ enum: BookingStatus }) status: BookingStatus;
  @ApiProperty({ enum: EVENT_TYPES }) eventType: string;

  @ApiProperty({ description: 'Event date, ISO 8601.' }) date: string;

  @ApiProperty({ nullable: true, type: String }) title: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Prisma Decimal(10,2) — serialises as a string over JSON.',
    example: '850.00',
  })
  fee: string | null;

  @ApiProperty({ nullable: true, type: String }) notes: string | null;

  @ApiProperty({
    description:
      'Opaque token for the unauthenticated client portal route (/booking/:token). Treat as a secret.',
  })
  portalToken: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'ISO 8601 timestamp the deposit was marked received; null until then.',
  })
  depositReceivedAt: string | null;

  @ApiProperty({ nullable: true, type: String }) travelMode: string | null;

  // Per ADR-0057's sibling convention for JSON columns: documented as an opaque object rather than
  // modelled, since the shape is a free-keyed map the frontend owns.
  @ApiProperty({
    nullable: true,
    type: Object,
    description:
      'On-the-day logistics (#170) — a map of concern key → { value, icon?, notes?, label?, ' +
      'shareWithBand, shareWithClient }. See BookingLogisticsEntry in apps/web/src/types/api.ts.',
  })
  logistics: Record<string, unknown> | null;

  @ApiProperty() customerId: string;
  @ApiProperty({ type: ContactResponseDto }) customer: ContactResponseDto;

  @ApiProperty({ nullable: true, type: String }) venueId: string | null;
  @ApiProperty({ type: ContactResponseDto, nullable: true }) venue: ContactResponseDto | null;

  @ApiProperty({ nullable: true, type: String }) bookingAgentId: string | null;
  @ApiProperty({ type: ContactResponseDto, nullable: true })
  bookingAgent: ContactResponseDto | null;

  @ApiProperty({ nullable: true, type: String }) seriesId: string | null;
  @ApiProperty({ type: BookingSeriesRefDto, nullable: true })
  series: BookingSeriesRefDto | null;

  @ApiProperty({ type: [BookingPerformanceSetDto], description: 'Ordered by `order` ascending.' })
  sets: BookingPerformanceSetDto[];

  @ApiProperty({ type: [BookingPackageDto], description: 'Ordered by `order` ascending.' })
  packages: BookingPackageDto[];

  // The music form config and response are collapsed to presence flags: the booking payload never
  // carries them in full (they have their own endpoints).
  @ApiProperty({ description: 'Whether the music form is switched on for this booking (ADR-0046).' })
  hasMusicFormConfig: boolean;

  @ApiProperty({ description: 'Whether the client has submitted the music form.' })
  hasMusicFormResponse: boolean;

  @ApiProperty({
    type: BookingActiveContractDto,
    nullable: true,
    description: 'Most recent contract; null when none has been created.',
  })
  activeContract: BookingActiveContractDto | null;

  @ApiProperty({
    type: BookingPortalVisibilityDto,
    description: 'Per-concern portal-visibility verdicts (ADR-0054).',
  })
  portalVisibility: BookingPortalVisibilityDto;
}
