import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUrl, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ClientPortalConfigDto } from './client-portal-config.dto';

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

  @ApiPropertyOptional({ type: ClientPortalConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClientPortalConfigDto)
  clientPortalConfig?: ClientPortalConfigDto;
}
