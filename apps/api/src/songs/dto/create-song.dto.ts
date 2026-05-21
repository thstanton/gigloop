import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SongGenre } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSongDto {
  @ApiProperty({ example: 'Clair de Lune' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: SongGenre })
  @IsEnum(SongGenre)
  genre!: SongGenre;

  @ApiPropertyOptional({ example: 'Claude Debussy' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  artist?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['classical', 'instrumental'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
