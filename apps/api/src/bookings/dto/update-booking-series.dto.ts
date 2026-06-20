import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class UpdateBookingSeriesDto {
  @ApiPropertyOptional({
    description: 'Existing series ID to assign, or null to remove from series. Mutually exclusive with newSeriesLabel.',
    nullable: true,
    example: 'uuid-of-series',
  })
  @IsOptional()
  @ValidateIf((o) => o.seriesId !== null && o.seriesId !== undefined)
  @IsUUID()
  seriesId?: string | null;

  @ApiPropertyOptional({
    description: 'Create a new series with this label and assign this booking to it. Mutually exclusive with seriesId.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  newSeriesLabel?: string;

  @ApiPropertyOptional({
    description: 'Must be true when API returns requiresConfirmation to confirm customer mismatch',
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
