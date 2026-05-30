import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSlotDto {
  @ApiPropertyOptional({ example: 'Ceremony' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  duration!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  order!: number;
}

export class CreatePackageDto {
  @ApiProperty({ example: 'Wedding Ceremony' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ example: 'heart' })
  @IsString()
  @IsNotEmpty()
  icon!: string;

  @ApiPropertyOptional({ example: 'WEDDING', nullable: true })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Notes about this package' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String], example: ['Processional', 'Recessional'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyMoments?: string[];

  @ApiPropertyOptional({ type: [String], example: ['CONTEMPORARY', 'CLASSICAL'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultGenreSelection?: string[];

  @ApiPropertyOptional({ type: [Boolean] })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: [CreateSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSlotDto)
  slots?: CreateSlotDto[];
}
