import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { BookingStatus } from '@prisma/client';

// Query for the pre-creation reminder preview (#560). The starting status the New Booking form is
// about to create the booking at — drives the same past-stage filter the Builder applies.
export class ReminderPreviewQueryDto {
  @ApiProperty({ enum: BookingStatus, description: 'The status the booking will be created at.' })
  @IsEnum(BookingStatus)
  status!: BookingStatus;
}
