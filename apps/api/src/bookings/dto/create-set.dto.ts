import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateSetDto {
  @ApiProperty({ example: 1, description: 'Position in the run-of-show (1-indexed)' })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiProperty({ example: 60, description: 'Duration in minutes' })
  @IsInt()
  @Min(1)
  duration!: number;

  @ApiPropertyOptional({ example: '18:00', description: 'Start time (HH:mm)' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ example: 'Ceremony' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiPropertyOptional({ description: 'Associate this set with a package' })
  @IsOptional()
  @IsString()
  packageId?: string;
}
