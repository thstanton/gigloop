import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LineupSlotUpsertDto {
  @ApiPropertyOptional({ description: 'Existing slot ID to update; omit to create new' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ example: 'Saxophone' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateLineupDto {
  @ApiPropertyOptional({ example: 'My five-piece' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    type: [LineupSlotUpsertDto],
    description: 'Full slot list; slots without ID are created, existing IDs updated, absent IDs deleted',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineupSlotUpsertDto)
  slots?: LineupSlotUpsertDto[];
}
