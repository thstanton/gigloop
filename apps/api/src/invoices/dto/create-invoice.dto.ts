import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateLineItemDto } from './create-line-item.dto';

export class CreateInvoiceDto {
  @ApiPropertyOptional({ enum: InvoiceStatus, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ default: false, description: 'Mark as a deposit invoice' })
  @IsOptional()
  @IsBoolean()
  isDeposit?: boolean;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Defaults to the booking customer when omitted' })
  @IsOptional()
  @IsUUID()
  billToContactId?: string;

  @ApiPropertyOptional({ type: () => CreateLineItemDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLineItemDto)
  lineItems?: CreateLineItemDto[];
}
