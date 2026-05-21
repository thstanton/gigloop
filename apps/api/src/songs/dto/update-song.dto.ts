import { ApiPropertyOptional } from '@nestjs/swagger';
import { SongGenre } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateSongDto {
  @ApiPropertyOptional({ example: 'Clair de Lune' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ enum: SongGenre })
  @IsOptional()
  @IsEnum(SongGenre)
  genre?: SongGenre;

  @ApiPropertyOptional({ example: 'Claude Debussy', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @IsNotEmpty()
  artist?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
