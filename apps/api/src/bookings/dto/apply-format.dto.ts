import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ApplyFormatDto {
  @ApiProperty({ example: 'uuid-of-performance-format' })
  @IsUUID()
  formatId!: string;
}
