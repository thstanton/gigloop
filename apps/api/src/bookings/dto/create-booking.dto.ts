import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EVENT_TYPES } from '../../common/constants';

export class CreateBookingDto {
  @ApiProperty({ enum: EVENT_TYPES })
  @IsIn(EVENT_TYPES)
  eventType!: string;

  @ApiProperty({ example: '2026-09-15T14:00:00.000Z' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'uuid-of-customer-contact' })
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional({ enum: BookingStatus, default: 'ENQUIRY' })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ example: 'Smith Wedding' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ example: 2500, description: 'Agreed fee in major currency units' })
  @IsOptional()
  @IsNumber()
  fee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'uuid-of-venue-contact' })
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-referrer-contact' })
  @IsOptional()
  @IsUUID()
  referrerId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Performance format IDs to apply (in order)' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  formatIds?: string[];
}
