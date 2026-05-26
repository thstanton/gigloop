import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class SpecialRequestDto {
  @ApiProperty({ example: 'Processional' })
  @IsString()
  key!: string;

  @ApiPropertyOptional({ example: 'abc123' })
  @IsUUID()
  @IsOptional()
  songId?: string;

  @ApiPropertyOptional({ example: 'Something by Ed Sheeran' })
  @IsString()
  @IsOptional()
  freeText?: string;
}

export class SubmitMusicFormDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  selectedSongIds!: string[];

  @ApiProperty({ type: () => SpecialRequestDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialRequestDto)
  specialRequests!: SpecialRequestDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
