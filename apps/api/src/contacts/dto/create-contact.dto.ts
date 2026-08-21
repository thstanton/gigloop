import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';
import { PRIMARY_ROLES } from '../contact-roles';

export class CreateContactDto {
  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Jane', description: 'Informal first name used in greetings and emails' })
  @IsOptional()
  @IsString()
  greetingName?: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+44 7700 900000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '123 High Street' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'London' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Greater London' })
  @IsOptional()
  @IsString()
  county?: string;

  @ApiPropertyOptional({ example: 'SW1A 1AA' })
  @IsOptional()
  @IsString()
  postcode?: string;

  @ApiPropertyOptional({ example: 'GB', default: 'GB' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 51.5014 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: -0.1419 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 'ChIJdd4hrwug2EcRmSrV3Vo6llI' })
  @IsOptional()
  @IsString()
  placeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Venue parking information' })
  @IsOptional()
  @IsString()
  parkingInfo?: string;

  @ApiPropertyOptional({ description: 'Venue access and load-in information' })
  @IsOptional()
  @IsString()
  accessInfo?: string;

  @ApiPropertyOptional({ description: 'Backline and equipment available at venue' })
  @IsOptional()
  @IsString()
  equipmentAvailable?: string;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'Commission rate or arrangement for booking agents' })
  @IsOptional()
  @IsString()
  commissionArrangement?: string;

  @ApiPropertyOptional({ enum: PRIMARY_ROLES, nullable: true, description: 'Primary role of this contact' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(PRIMARY_ROLES)
  primaryRole?: string | null;

  // Band roster — dep profile (#886, ADR-0072 §4). Shared-with-band, not organiser-private.
  @ApiPropertyOptional({ example: 'Saxophone', description: 'Identity as a dep — the instrument they are known for (shared with band)' })
  @IsOptional()
  @IsString()
  primaryBandRole?: string;

  @ApiPropertyOptional({ type: [String], description: 'Declared capability — instruments/parts this dep can cover (shared with band)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  instruments?: string[];

  @ApiPropertyOptional({ description: 'How this dep gets to a gig (shared with band)' })
  @IsOptional()
  @IsString()
  travelNotes?: string;

  @ApiPropertyOptional({ description: 'What this dep brings/needs (shared with band)' })
  @IsOptional()
  @IsString()
  equipmentNotes?: string;

  @ApiPropertyOptional({ description: 'Stage-wear notes for this dep (shared with band)' })
  @IsOptional()
  @IsString()
  outfitNotes?: string;

  @ApiPropertyOptional({ description: 'Free-text availability commentary (shared with band) — never structured, see ADR-0072 §4' })
  @IsOptional()
  @IsString()
  availabilityNotes?: string;
}
