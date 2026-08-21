import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateChairDto {
  @ApiProperty({ example: 'Saxophone', description: 'Free-text seat role.' })
  @IsString()
  @IsNotEmpty()
  role!: string;

  @ApiProperty({ example: 1, description: 'Position among this booking\'s chairs (1-indexed)' })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiPropertyOptional({
    description: 'Associate this chair with a booking-owned package (segment); omit for a package-less chair.',
  })
  @IsOptional()
  @IsUUID()
  packageId?: string;
}
