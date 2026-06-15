import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SendInvoiceDto {
  @ApiPropertyOptional({ example: '2026-06-01', description: 'Required for DRAFT invoices; omit when sending an ISSUED invoice (dates were set at issue time)' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  to!: string;

  @ApiProperty()
  @IsUUID()
  contactId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  templateId?: string;
}
