import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';
import { PRIMARY_ROLES } from '../contact-roles';

export class UpdateContactDto {
  @ApiPropertyOptional({ example: 'Jane Smith' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 'Jane', nullable: true, description: 'Informal first name used in greetings and emails' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  greetingName?: string | null;

  @ApiPropertyOptional({ example: 'jane@example.com', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: '+44 7700 900000', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ example: '123 High Street', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  addressLine1?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  addressLine2?: string | null;

  @ApiPropertyOptional({ example: 'London', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  city?: string | null;

  @ApiPropertyOptional({ example: 'Greater London', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  county?: string | null;

  @ApiPropertyOptional({ example: 'SW1A 1AA', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  postcode?: string | null;

  @ApiPropertyOptional({ example: 'GB', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  country?: string | null;

  @ApiPropertyOptional({ example: 51.5014, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  latitude?: number | null;

  @ApiPropertyOptional({ example: -0.1419, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  longitude?: number | null;

  @ApiPropertyOptional({ example: 'ChIJdd4hrwug2EcRmSrV3Vo6llI', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  placeId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  parkingInfo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  accessInfo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  equipmentAvailable?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  website?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  commissionArrangement?: string | null;

  @ApiPropertyOptional({ enum: PRIMARY_ROLES, nullable: true, description: 'Primary role of this contact' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(PRIMARY_ROLES)
  primaryRole?: string | null;

  // Band roster — dep profile (#886, ADR-0072 §4). Shared-with-band, not organiser-private.
  @ApiPropertyOptional({ example: 'Saxophone', nullable: true, type: String, description: 'Identity as a dep — the instrument they are known for (shared with band)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  primaryBandRole?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Declared capability — instruments/parts this dep can cover (shared with band)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instruments?: string[];

  @ApiPropertyOptional({ nullable: true, type: String, description: 'How this dep gets to a gig (shared with band)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  travelNotes?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'What this dep brings/needs (shared with band)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  equipmentNotes?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Stage-wear notes for this dep (shared with band)' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  outfitNotes?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Free-text availability commentary (shared with band) — never structured, see ADR-0072 §4' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  availabilityNotes?: string | null;
}
