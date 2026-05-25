import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class RenderEmailQueryDto {
  @ApiProperty({ description: 'Template to render' })
  @IsUUID()
  templateId!: string;

  @ApiPropertyOptional({ description: 'Invoice ID for invoice-specific variable substitution' })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Issue date override for draft invoice preview', example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ description: 'Due date override for draft invoice preview', example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
