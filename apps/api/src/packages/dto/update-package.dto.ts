import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SlotUpsertDto {
  @ApiPropertyOptional({ description: 'Existing slot ID to update; omit to create new' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ example: 'Ceremony' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdatePackageDto {
  @ApiPropertyOptional({ example: 'Wedding Ceremony' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: 'heart' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 'WEDDING', nullable: true })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({ example: 'Notes about this package', nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyMoments?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultGenreSelection?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: [SlotUpsertDto], description: 'Full slot list; slots without ID are created, existing IDs updated, absent IDs deleted' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotUpsertDto)
  slots?: SlotUpsertDto[];
}
