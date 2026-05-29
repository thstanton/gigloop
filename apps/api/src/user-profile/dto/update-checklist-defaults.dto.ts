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
} from 'class-validator';

export class DueDateRuleDto {
  @ApiProperty({ enum: ['bookingDate', 'bookingCreation'] })
  @IsIn(['bookingDate', 'bookingCreation'])
  basis!: 'bookingDate' | 'bookingCreation';

  @ApiProperty()
  @IsInt()
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

  @ApiPropertyOptional({ nullable: true, enum: ['CONFIRMED', 'READY', 'COMPLETE'] })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(['CONFIRMED', 'READY', 'COMPLETE'])
  requiredForStatus?: 'CONFIRMED' | 'READY' | 'COMPLETE' | null;

  @ApiPropertyOptional({ nullable: true, type: DueDateRuleDto })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => DueDateRuleDto)
  @IsObject()
  dueDateRule?: DueDateRuleDto | null;
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
