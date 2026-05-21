import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateTemplateDto {
  @ApiPropertyOptional({ example: 'Wedding Confirmation' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'Tiptap JSON document object' })
  @IsOptional()
  @IsObject()
  content?: object;
}
