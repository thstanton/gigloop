import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class MarkSentDto {
  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
