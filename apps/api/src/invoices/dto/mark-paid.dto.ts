import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Marking an invoice paid records **when** the payment was received (ADR-0068). `paidAt` is
 * required and must be a parseable date — the request is rejected rather than silently defaulting
 * to now, which was the tap-moment bug this whole change fixes.
 */
export class MarkPaidDto {
  @ApiProperty({ description: 'The date the payment was received (defaults to today in the UI)', example: '2026-08-18' })
  @IsDateString()
  paidAt: string;

  @ApiPropertyOptional({ description: 'Optional payment reference, e.g. a bank reference', example: 'BACS-4417', maxLength: 140 })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  paymentReference?: string;
}
