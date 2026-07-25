import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';

// ADR-0067 §3: the palette result contract is a discriminated array — `{ type, id, url, …display }`
// — not a grouped `{ bookings, contacts }` object, so adding a searchable entity later (the set is
// architecturally open) is a new `type` value, never a wire-shape change.
//
// Two concrete DTOs (one per entity) rather than a single class with a pile of optional fields —
// each is fully described for Scalar, and the discriminant plus per-type fields read cleanly.
// `SearchResultDto` is the documented union; `SearchResult` is the plain type the service returns.

export class BookingSearchResultDto {
  @ApiProperty({ enum: ['booking'], example: 'booking' })
  type!: 'booking';

  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '/admin/bookings/9f2c...' })
  url!: string;

  @ApiProperty({ description: 'Booking title, falling back to the customer name when untitled.' })
  title!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Venue name, when set.' })
  subtitle!: string | null;

  @ApiProperty({ enum: BookingStatus })
  status!: BookingStatus;

  @ApiProperty({ description: 'ISO 8601 event date.' })
  date!: string;

  @ApiProperty()
  eventType!: string;
}

export class ContactSearchResultDto {
  @ApiProperty({ enum: ['contact'], example: 'contact' })
  type!: 'contact';

  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '/admin/contacts/9f2c...' })
  url!: string;

  @ApiProperty({ description: 'Contact name.' })
  title!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Email, falling back to phone, when set.' })
  subtitle!: string | null;

  @ApiProperty({ description: 'Total bookings this contact appears on (customer, venue, or agent).' })
  bookingCount!: number;
}

export type SearchResultDto = BookingSearchResultDto | ContactSearchResultDto;
