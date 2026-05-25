import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class RenderEmailQueryDto {
  @ApiProperty({ description: 'Template to render' })
  @IsUUID()
  templateId!: string;

  @ApiPropertyOptional({ description: 'Invoice ID for invoice-specific variable substitution' })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}
