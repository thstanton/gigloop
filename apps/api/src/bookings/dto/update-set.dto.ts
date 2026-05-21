import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class UpdateSetDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({ example: 60, description: 'Duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ example: '18:00', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  startTime?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @IsNotEmpty()
  label?: string | null;
}
