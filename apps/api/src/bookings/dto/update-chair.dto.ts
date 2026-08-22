import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateChairDto {
  @ApiPropertyOptional({ example: 'Saxophone' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  role?: string;

  @ApiPropertyOptional({ example: 1, description: "Position within the chair's Lineup (ADR-0081)." })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({
    description: 'Re-parent the chair to this existing Lineup (ADR-0081 §1: only an instance can be pointed at).',
  })
  @IsOptional()
  @IsUUID()
  lineupId?: string;
}
