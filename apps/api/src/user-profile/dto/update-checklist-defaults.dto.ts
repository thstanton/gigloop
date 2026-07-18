import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
  IsObject,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';

// #718: a reminder anchored to booking creation cannot fall *before* the record exists — the
// `bookingCreation` anchor is after-only. `bookingDate` keeps both directions. The editor prevents
// the invalid combination in the UI; this is the write-path backstop.
@ValidatorConstraint({ name: 'bookingCreationAfterOnly' })
export class BookingCreationAfterOnlyConstraint implements ValidatorConstraintInterface {
  validate(offsetDays: number, args: ValidationArguments): boolean {
    const rule = args.object as DueDateRuleDto;
    return !(rule.basis === 'bookingCreation' && typeof offsetDays === 'number' && offsetDays < 0);
  }
  defaultMessage(): string {
    return 'A reminder anchored to booking creation cannot be before it — offsetDays must be ≥ 0 when basis is bookingCreation';
  }
}

export class DueDateRuleDto {
  @ApiProperty({ enum: ['bookingDate', 'bookingCreation'] })
  @IsIn(['bookingDate', 'bookingCreation'])
  basis!: 'bookingDate' | 'bookingCreation';

  @ApiProperty({
    description:
      'Days relative to the basis; negative = before, positive = after. Must be ≥ 0 when basis is bookingCreation (a reminder cannot predate the booking record).',
  })
  @IsInt()
  @Validate(BookingCreationAfterOnlyConstraint)
  offsetDays!: number;
}

export class SystemItemOverrideDto {
  @ApiProperty({ description: 'Key of the system checklist item to override' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ nullable: true, type: DueDateRuleDto })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => DueDateRuleDto)
  @IsObject()
  dueDateRule?: DueDateRuleDto | null;
}

export class CustomChecklistItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ enum: ['USER', 'CUSTOMER', 'BAND_MEMBER'] })
  @IsIn(['USER', 'CUSTOMER', 'BAND_MEMBER'])
  completedBy!: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ nullable: true, enum: ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'])
  requiredForStatus?: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;

  @ApiPropertyOptional({ nullable: true, type: DueDateRuleDto })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => DueDateRuleDto)
  @IsObject()
  dueDateRule?: DueDateRuleDto | null;

  @ApiPropertyOptional({
    enum: ['overview', 'people', 'venue', 'itinerary', 'music'],
    nullable: true,
    description: 'Tag this global custom default to a concern so it appears in that section on every booking (#561).',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(['overview', 'people', 'venue', 'itinerary', 'music'])
  concern?: 'overview' | 'people' | 'venue' | 'itinerary' | 'music' | null;
}

export class UpdateChecklistDefaultsDto {
  @ApiPropertyOptional({ example: 7, minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  reminderLeadDays?: number;

  @ApiPropertyOptional({ type: [SystemItemOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SystemItemOverrideDto)
  systemItemOverrides?: SystemItemOverrideDto[];

  @ApiPropertyOptional({ type: [CustomChecklistItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomChecklistItemDto)
  customItems?: CustomChecklistItemDto[];
}
