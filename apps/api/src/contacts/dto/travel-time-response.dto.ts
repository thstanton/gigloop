import { ApiProperty } from '@nestjs/swagger';

export class TravelTimeResponseDto {
  @ApiProperty({ example: 45 })
  minutes: number;

  @ApiProperty({ example: 62000 })
  distanceMetres: number;

  @ApiProperty({ example: '2026-06-01T10:00:00.000Z' })
  calculatedAt: string;
}
