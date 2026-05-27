import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsDateString, IsIn, IsOptional } from 'class-validator';

const CONTRACT_STATUSES = ['DRAFT', 'VOID', 'SIGNED'] as const;

export class UpdateContractDto {
  @ApiPropertyOptional({ description: 'Tiptap JSON content', nullable: true })
  @IsOptional()
  @Allow()
  content?: unknown;

  @ApiPropertyOptional({ enum: CONTRACT_STATUSES })
  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ example: '2026-06-15T10:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  signedAt?: string;
}
