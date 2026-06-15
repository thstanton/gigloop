import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class IssueInvoiceDto {
  @ApiPropertyOptional({ description: 'Issue date (defaults to today)', example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ description: 'Due date (defaults to issueDate + defaultPaymentTermsDays)', example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
