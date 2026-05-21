import type { BookingStatus, EventType } from '@prisma/client';

export class UpdateBookingDto {
  eventType?: EventType;
  date?: string;
  customerId?: string;
  status?: BookingStatus;
  title?: string | null;
  fee?: number | null;
  notes?: string | null;
  venueId?: string | null;
  referrerId?: string | null;
}
