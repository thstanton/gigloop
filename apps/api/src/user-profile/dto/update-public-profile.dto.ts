import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class UpdatePublicProfileDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'Smith String Quartet' })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  logoUrl?: string | null;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsString()
  brandColour?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  photo?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUrl()
  website?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  socials?: Record<string, string> | null;

  @ApiPropertyOptional({
    enum: ['LIGHT_MODERN', 'LIGHT_ROMANTIC', 'BOLD_MODERN', 'BOLD_ROMANTIC'],
  })
  @IsOptional()
  @IsIn(['LIGHT_MODERN', 'LIGHT_ROMANTIC', 'BOLD_MODERN', 'BOLD_ROMANTIC'])
  portalTheme?: string;
}
