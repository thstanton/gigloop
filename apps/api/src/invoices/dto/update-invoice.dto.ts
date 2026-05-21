import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-06-15', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  billToContactId?: string;
}
