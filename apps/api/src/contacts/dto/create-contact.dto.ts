import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

const PRIMARY_ROLES = ['CUSTOMER', 'VENUE', 'BOOKING_AGENT'] as const;

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
}
