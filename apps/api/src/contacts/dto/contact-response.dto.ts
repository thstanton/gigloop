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

  @ApiPropertyOptional({ nullable: true, type: String }) greetingName: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) email: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) phone: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) notes: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) addressLine1: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) addressLine2: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) city: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) county: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) postcode: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) country: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number }) latitude: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) longitude: number | null;
  @ApiPropertyOptional({ nullable: true, type: String }) placeId: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number }) travelTimeMinutes: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) travelDistanceMetres: number | null;
  @ApiPropertyOptional({ nullable: true, type: String }) travelTimeCalculatedAt: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) travelMode: string | null;

  @ApiPropertyOptional({ nullable: true, type: String }) parkingInfo: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) accessInfo: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) equipmentAvailable: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) website: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) commissionArrangement: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) primaryRole: string | null;
}
