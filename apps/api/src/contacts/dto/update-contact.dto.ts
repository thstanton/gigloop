import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

const PRIMARY_ROLES = ['CUSTOMER', 'VENUE', 'BOOKING_AGENT'] as const;

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
}
