import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ClientPortalConfigDto {
  @ApiPropertyOptional({ enum: ['LIGHT_MODERN', 'LIGHT_ROMANTIC', 'BOLD_MODERN', 'BOLD_ROMANTIC'] })
  @IsOptional()
  @IsIn(['LIGHT_MODERN', 'LIGHT_ROMANTIC', 'BOLD_MODERN', 'BOLD_ROMANTIC'])
  theme?: string;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsString()
  brandColour?: string;

  @ApiPropertyOptional({ nullable: true, enum: ['piano', 'stage'] })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsIn(['piano', 'stage'])
  heroImage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showContactPhoto?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showContactEmail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showContactPhone?: boolean;
}
