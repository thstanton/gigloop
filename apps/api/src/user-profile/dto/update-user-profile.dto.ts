import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

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

  @ApiPropertyOptional({ example: 20, description: 'VAT rate as a percentage (0–100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  vatRate?: number;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultPaymentTermsDays?: number;

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

  @ApiPropertyOptional({
    description: 'User preferences JSON — merged with existing value on PATCH',
    example: { reminderLeadDays: 7 },
  })
  @IsOptional()
  @IsObject()
  @Allow()
  preferences?: Record<string, unknown>;
}
