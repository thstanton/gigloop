import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class CopyBookingDto {
  @ApiProperty({
    example: '2026-09-15T14:00:00.000Z',
    description: 'Event date for the copied booking (ISO 8601). The only field the musician supplies — everything else is cloned from the source booking.',
  })
  @IsDateString()
  date!: string;
}
