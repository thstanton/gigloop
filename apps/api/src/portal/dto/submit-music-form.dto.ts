import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

// #691: this DTO is filled from the unauthenticated portal submit. The caps are set well
// above anything a real client would type — they bound the payload, they are not a
// formatting rule (the portal form has no matching maxLength, so a cap a genuine user
// could hit would surface as an opaque 400).
const KEY_MAX = 200;
const FREE_TEXT_MAX = 500;
const NOTES_MAX = 2000;

export class SpecialRequestDto {
  @ApiProperty({ example: 'Processional', maxLength: KEY_MAX })
  @IsString()
  @MaxLength(KEY_MAX)
  key!: string;

  @ApiPropertyOptional({ example: 'abc123' })
  @IsUUID()
  @IsOptional()
  songId?: string;

  @ApiPropertyOptional({ example: 'Something by Ed Sheeran', maxLength: FREE_TEXT_MAX })
  @IsString()
  @IsOptional()
  @MaxLength(FREE_TEXT_MAX)
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

  @ApiPropertyOptional({ maxLength: NOTES_MAX })
  @IsString()
  @IsOptional()
  @MaxLength(NOTES_MAX)
  notes?: string;
}
