import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLineupSlotDto {
  // Deliberately no @IsNotEmpty(): a blank role is already a legal state everywhere else
  // (LineupSlotUpsertDto.role accepts '' on PATCH, and the UI falls back to "Unnamed" for
  // display) — @IsNotEmpty() here would only make create reject what update accepts.
  @ApiProperty({ example: 'Saxophone' })
  @IsString()
  role!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  order!: number;
}

export class CreateLineupDto {
  @ApiProperty({ example: 'My five-piece' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ type: [CreateLineupSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLineupSlotDto)
  slots?: CreateLineupSlotDto[];
}
