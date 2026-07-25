import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description:
      'Free-text search across bookings and contacts. Omit (or pass an empty string) to browse ' +
      'the top-N most relevant rows of each type unfiltered.',
    example: 'smith',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
