import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export class UpdateUserProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  bankDetails?: string | null;

  @ApiPropertyOptional({ example: 'GB123456789' })
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultPaymentTermsDays?: number;

  @ApiPropertyOptional({ enum: ['INVOICE', 'MANUAL'] })
  @IsOptional()
  @IsIn(['INVOICE', 'MANUAL'])
  depositTrackingMode?: string;

  @ApiPropertyOptional({ example: 30, description: 'Default deposit percentage (1–100)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  digestEmailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  songRequestFormEnabled?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  quoteReminderDays?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  contractReminderDays?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  depositInvoiceReminderDays?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  balanceInvoiceReminderDays?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  musicFormReminderDays?: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Days after the event' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  thankYouReminderDays?: number | null;
}
