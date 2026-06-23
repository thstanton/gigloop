import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateChecklistItemDto {
  @ApiProperty({ example: 'Book photographer' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({
    enum: ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'],
    nullable: true,
  })
  @IsOptional()
  @IsIn(['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE', null])
  requiredForStatus?: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    enum: ['overview', 'people', 'venue', 'itinerary', 'music'],
    nullable: true,
    description: 'Tag the custom item to a concern so it appears in that section’s control.',
  })
  @IsOptional()
  @IsIn(['overview', 'people', 'venue', 'itinerary', 'music', null])
  concern?: 'overview' | 'people' | 'venue' | 'itinerary' | 'music' | null;
}
