import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Wire shape of a Contact as surfaced to the client — mirrors `Contact` in
// apps/web/src/types/api.ts (no `userId`; Prisma Decimal/DateTime serialise as
// string/number). Used for documentation-only typing where a contact is nested
// in another response (e.g. an invoice's `billToContact`).
export class ContactResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
  @ApiProperty() name: string;

  @ApiPropertyOptional({ nullable: true }) greetingName: string | null;
  @ApiPropertyOptional({ nullable: true }) email: string | null;
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
  @ApiPropertyOptional({ nullable: true }) addressLine1: string | null;
  @ApiPropertyOptional({ nullable: true }) addressLine2: string | null;
  @ApiPropertyOptional({ nullable: true }) city: string | null;
  @ApiPropertyOptional({ nullable: true }) county: string | null;
  @ApiPropertyOptional({ nullable: true }) postcode: string | null;
  @ApiPropertyOptional({ nullable: true }) country: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number }) latitude: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) longitude: number | null;
  @ApiPropertyOptional({ nullable: true }) placeId: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number }) travelTimeMinutes: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) travelDistanceMetres: number | null;
  @ApiPropertyOptional({ nullable: true }) travelTimeCalculatedAt: string | null;
  @ApiPropertyOptional({ nullable: true }) travelMode: string | null;

  @ApiPropertyOptional({ nullable: true }) parkingInfo: string | null;
  @ApiPropertyOptional({ nullable: true }) accessInfo: string | null;
  @ApiPropertyOptional({ nullable: true }) equipmentAvailable: string | null;
  @ApiPropertyOptional({ nullable: true }) website: string | null;
  @ApiPropertyOptional({ nullable: true }) commissionArrangement: string | null;
  @ApiPropertyOptional({ nullable: true }) primaryRole: string | null;
}
