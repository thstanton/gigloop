import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Wedding Confirmation' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Tiptap JSON document object' })
  @IsObject()
  content!: object;
}
