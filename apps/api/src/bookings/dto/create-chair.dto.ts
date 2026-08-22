import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateChairDto {
  @ApiProperty({ example: 'Saxophone', description: 'Free-text seat role.' })
  @IsString()
  @IsNotEmpty()
  role!: string;

  @ApiPropertyOptional({
    description:
      'Segment to seat this chair in; omit for a package-less/whole-day chair. Joins the Lineup ' +
      'already playing this segment, or starts a new one — `order` (position within that Lineup) ' +
      'is computed server-side, since the target Lineup may not exist yet (ADR-0081).',
  })
  @IsOptional()
  @IsUUID()
  packageId?: string;
}
