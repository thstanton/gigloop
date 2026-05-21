import type { BookingStatus, EventType } from '@prisma/client';
import type { CreateSetDto } from './create-set.dto';

export class CreateBookingDto {
  eventType!: EventType;
  date!: string;
  customerId!: string;
  status?: BookingStatus;
  title?: string;
  fee?: number;
  notes?: string;
  venueId?: string;
  referrerId?: string;
  sets?: CreateSetDto[];
}
