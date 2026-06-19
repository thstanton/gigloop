import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateBookingPackageDto {
  @ApiPropertyOptional({ example: 'Evening Reception' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiPropertyOptional({ example: 'music' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  icon?: string;
}
