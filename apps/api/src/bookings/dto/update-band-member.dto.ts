import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, ValidateIf } from 'class-validator';
import { BAND_MEMBER_STATUSES, BandMemberStatus } from '../band-member-status';

export class UpdateBandMemberDto {
  @ApiPropertyOptional({
    enum: BAND_MEMBER_STATUSES,
    description: 'Every transition in this slice is organiser-driven from the Band sheet (ADR-0072 §5).',
  })
  @IsOptional()
  @IsIn(BAND_MEMBER_STATUSES)
  status?: BandMemberStatus;

  @ApiPropertyOptional({ example: 150, nullable: true, type: Number, description: 'Per-person session fee.' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  sessionFee?: number | null;

  @ApiPropertyOptional({
    description: 'Marks this member as the musician themself (ADR-0072 §3) — does not fill a chair on its own.',
  })
  @IsOptional()
  @IsBoolean()
  isSelf?: boolean;
}
