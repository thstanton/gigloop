import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SONG_GENRES } from '../../common/constants';

export class CreateSongDto {
  @ApiProperty({ example: 'Clair de Lune' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: SONG_GENRES })
  @IsIn(SONG_GENRES)
  genre!: string;

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
