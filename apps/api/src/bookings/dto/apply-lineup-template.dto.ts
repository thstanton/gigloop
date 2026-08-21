import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ApplyLineupTemplateDto {
  @ApiProperty({ example: 'uuid-of-lineup-template' })
  @IsUUID()
  lineupTemplateId!: string;

  @ApiPropertyOptional({
    description:
      'Attach the resulting chairs to this booking-owned package (segment); omit for a package-less/whole-day lineup.',
  })
  @IsOptional()
  @IsUUID()
  packageId?: string;
}
