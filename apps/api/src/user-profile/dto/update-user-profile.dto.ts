import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

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
}
