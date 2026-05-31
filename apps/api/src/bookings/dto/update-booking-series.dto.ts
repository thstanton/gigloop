import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class UpdateBookingSeriesDto {
  @ApiProperty({
    description: 'Series ID to assign, or null to remove from series',
    nullable: true,
    example: 'uuid-of-series',
  })
  @ValidateIf((o) => o.seriesId !== null)
  @IsUUID()
  seriesId!: string | null;

  @ApiPropertyOptional({
    description: 'Must be true when API returns requiresConfirmation to confirm customer mismatch',
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
