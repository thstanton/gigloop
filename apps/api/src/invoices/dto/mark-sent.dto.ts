import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class MarkSentDto {
  @ApiPropertyOptional({ description: 'Issue date — only required for DRAFT invoices; ignored for ISSUED invoices (date was set at issue time)', example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
