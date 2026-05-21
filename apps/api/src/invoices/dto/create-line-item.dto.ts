import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLineItemDto {
  @ApiProperty({ example: 'Performance fee' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ example: 1500, description: 'Amount in major currency units' })
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ example: 0, description: 'Sort order (defaults to array index)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
