import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EVENT_TYPES } from '../../common/constants';
import type { DueDateRule } from '../checklist-defaults';

export class NewSeriesInput {
  @ApiProperty({ example: 'Hotel Intercontinental — May 2026' })
  @IsString()
  @IsNotEmpty()
  label!: string;
}

export class ChecklistItemInput {
  @ApiProperty({ example: 'send_quote', nullable: true })
  @IsOptional()
  @IsString()
  key?: string | null;

  @ApiProperty({ example: 'Send quote' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ enum: ['USER', 'CUSTOMER', 'BAND_MEMBER'], default: 'USER' })
  @IsOptional()
  @IsIn(['USER', 'CUSTOMER', 'BAND_MEMBER'])
  completedBy?: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependsOn?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  autoCompleteRule?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    enum: ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'],
    nullable: true,
  })
  @IsOptional()
  @IsIn(['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE', null])
  requiredForStatus?: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  dueDateRule?: DueDateRule | null;
}

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

  @ApiPropertyOptional({ enum: BookingStatus, default: 'PROVISIONAL' })
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

  @ApiPropertyOptional({ example: 'uuid-of-booking-agent-contact' })
  @IsOptional()
  @IsUUID()
  bookingAgentId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Package template IDs to apply (in order)' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  packageTemplateIds?: string[];

  @ApiPropertyOptional({
    description:
      'Create the music form (song request form) for this booking on creation. Presence of the config row is the on/off truth — this flag only decides whether that row is created. Seeded from the chosen package templates when packages are applied.',
  })
  @IsOptional()
  @IsBoolean()
  enableMusicForm?: boolean;

  @ApiProperty({ type: [ChecklistItemInput], description: 'Checklist items to seed for this booking' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemInput)
  checklistItems!: ChecklistItemInput[];

  @ApiPropertyOptional({ example: 'uuid-of-existing-series', description: 'Assign to an existing series' })
  @IsOptional()
  @IsUUID()
  seriesId?: string;

  @ApiPropertyOptional({ description: 'Create a new series for this booking' })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewSeriesInput)
  newSeries?: NewSeriesInput;
}
