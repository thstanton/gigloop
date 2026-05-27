import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

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

  @ApiPropertyOptional({ example: '123 High Street, London, SW1A 1AA' })
  @IsOptional()
  @IsString()
  address?: string;

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

  @ApiPropertyOptional({ description: 'Commission rate or arrangement for referrers' })
  @IsOptional()
  @IsString()
  commissionArrangement?: string;
}
