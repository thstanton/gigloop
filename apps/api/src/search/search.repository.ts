import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildBookingSearchWhere } from '../bookings/booking-search';
import { buildContactSearchWhere } from '../contacts/contact-search';

// ADR-0067 §5: the palette is a "find anything" tool — it searches all six statuses, unlike
// GET /bookings's active-pipeline default. Deliberately calling the neutral where-builder with
// its own status set rather than reusing GET /bookings?q= (§2).
const ALL_BOOKING_STATUSES = Object.values(BookingStatus);

export type BookingSearchRow = {
  id: string;
  title: string | null;
  date: Date;
  status: BookingStatus;
  eventType: string;
  customer: { name: string };
  venue: { name: string } | null;
};

export type ContactSearchRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  _count: {
    customerBookings: number;
    venueBookings: number;
    bookingAgentBookings: number;
  };
};

@Injectable()
export class SearchRepository {
  constructor(private prisma: PrismaService) {}

  // Unbounded by `take`: at solo-musician scale (ADR-0067 §9 — the same trade-off as ADR-0041)
  // a tenant's whole booking/contact set is a few hundred rows, so fetching every match and
  // ranking/capping in the service is simpler and cheaper than expressing "upcoming-first, then
  // recent-past" as SQL `ORDER BY`.
  searchBookings(userId: string, q: string | undefined): Promise<BookingSearchRow[]> {
    return this.prisma.booking.findMany({
      where: buildBookingSearchWhere(userId, q, ALL_BOOKING_STATUSES),
      select: {
        id: true,
        title: true,
        date: true,
        status: true,
        eventType: true,
        customer: { select: { name: true } },
        venue: { select: { name: true } },
      },
    });
  }

  searchContacts(userId: string, q: string | undefined): Promise<ContactSearchRow[]> {
    return this.prisma.contact.findMany({
      where: buildContactSearchWhere(userId, q),
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        _count: {
          select: {
            customerBookings: true,
            venueBookings: true,
            bookingAgentBookings: true,
          },
        },
      },
    });
  }
}
