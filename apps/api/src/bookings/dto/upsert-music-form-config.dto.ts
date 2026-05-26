import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class KeyMomentDto {
  @ApiProperty({ example: 'Processional' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({ example: 'Ceremony' })
  @IsString()
  @IsNotEmpty()
  section!: string;
}

export class UpsertMusicFormConfigDto {
  @ApiProperty({ type: () => KeyMomentDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KeyMomentDto)
  keyMoments!: KeyMomentDto[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  enabledGenres!: string[];
}
