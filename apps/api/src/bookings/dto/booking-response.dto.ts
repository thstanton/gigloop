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

// The wire shape of a single booking, as constructed by `BookingsService.mapBooking` — the one
// place every read and write method builds this shape (ADR-0071 / #872). `mapBooking` carries a
// real return type (`MappedBooking`, in bookings.service.ts) rather than `any`, but nothing
// `satisfies`-checks it against this DTO: `MappedBooking`'s dates/Decimal stay as Prisma's native
// `Date`/`Decimal` (JSON-serialised correctly without conversion), while this DTO documents them as
// `string` per the shared-types convention below — so the two are related by convention, not by
// the compiler. **Update this DTO whenever `mapBooking`'s output changes** (#786).
//
// Mirrors `BookingDetail` in apps/web/src/types/api.ts, with one deliberate difference: Prisma
// `Decimal` is documented as `string` and `DateTime` as an ISO `string`, per the shared-types
// convention.
//
// `userId` is omitted, exactly as `ContactResponseDto` omits it — and, since #873 (ADR-0071), it is
// no longer on the wire either: the repository's `bookingDetailSelect` is an explicit `select`
// naming every field below (top-level booking, nested contacts, sets, packages), not an `include`
// that would return every scalar including the tenancy id.
//
// Two decorator traps this file deliberately avoids, both of which produce *wrong* docs silently:
//   • A `string | null` property needs an explicit `type: String`. The reflected design-type of a
//     union is `Object`, so `{ nullable: true }` alone documents the field as `type: object`.
//   • Nullable is not optional. Every field here is always a key in the JSON (`bookingDetailSelect`
//     names every field explicitly, so Prisma always returns it) — so they take `@ApiProperty`, not
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

// A seat in a segment (ADR-0072 §2 / #884). `memberId` is nullable throughout Band members v1's
// first slice — a vacancy is `memberId = null`, a first-class thing the musician looks at, not an
// absence. `callTime` is derived (never stored) from the earliest `PerformanceSet.startTime` in
// this chair's segment (`packageId`), and is absent — not zero, not a placeholder — when that
// segment has no start time.
export class BookingBandChairDto {
  @ApiProperty() id: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) createdAt: string;
  @ApiProperty({ description: 'ISO 8601 timestamp' }) updatedAt: string;
  @ApiProperty() bookingId: string;

  @ApiProperty() role: string;
  @ApiProperty({ description: 'Position among this booking\'s chairs (ascending).' }) order: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Owning booking-level Package (segment); null for a package-less chair.',
  })
  packageId: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Null = vacant.' })
  memberId: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Derived from the segment\'s earliest PerformanceSet.startTime (HH:mm); null when unset.',
  })
  callTime: string | null;
}

// ADR-0073 §6: the organiser read path. Chairs and (from #885) members, removed members excluded.
export class BookingBandDto {
  @ApiProperty({ type: [BookingBandChairDto] })
  chairs: BookingBandChairDto[];
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

  @ApiProperty({
    type: BookingBandDto,
    description: 'The band roster (ADR-0072/0073 §6). `chairs` only in this slice; `members` arrives in #885.',
  })
  band: BookingBandDto;
}
