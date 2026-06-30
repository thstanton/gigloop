import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

type TravelTimeData = {
  travelTimeMinutes: number;
  travelDistanceMetres: number;
  travelTimeCalculatedAt: Date;
  travelMode: string;
};

type ContactUpdateData = UpdateContactDto & {
  travelTimeMinutes?: number | null;
  travelDistanceMetres?: number | null;
  travelTimeCalculatedAt?: Date | null;
  travelMode?: string | null;
};

// The contact detail page lists each related booking as a BookingRef — id/title/date/status/
// eventType only (#592). Selecting exactly those drops the rest of the Booking row (the
// `logistics` JSON, notes, portalToken, etc.) from a contact's whole history. `take` is a
// defensive upper bound against a pathologically long history, not a UX page size: ordered
// date-desc, it can only ever drop the oldest tail, and 200 is far above any real contact's
// gig count. If that ever truncates a real list, the fix is a paginated "show all" view.
const CONTACT_BOOKING_REF = {
  select: { id: true, title: true, date: true, status: true, eventType: true },
  orderBy: { date: 'desc' as const },
  take: 200,
} as const;

@Injectable()
export class ContactsRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.contact.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  findOne(userId: string, id: string) {
    return this.prisma.contact.findFirst({
      where: { id, userId },
      include: {
        customerBookings: CONTACT_BOOKING_REF,
        venueBookings: CONTACT_BOOKING_REF,
        bookingAgentBookings: CONTACT_BOOKING_REF,
      },
    });
  }

  create(userId: string, data: CreateContactDto) {
    return this.prisma.contact.create({
      data: { userId, ...data },
    });
  }

  update(id: string, data: ContactUpdateData) {
    return this.prisma.contact.update({
      where: { id },
      data,
    });
  }

  updateTravelTime(id: string, data: TravelTimeData) {
    return this.prisma.contact.update({ where: { id }, data });
  }

  clearTravelTimeForUser(userId: string) {
    return this.prisma.contact.updateMany({
      where: { userId },
      data: {
        travelTimeMinutes: null,
        travelDistanceMetres: null,
        travelTimeCalculatedAt: null,
        travelMode: null,
      },
    });
  }

  async countBookings(userId: string, id: string): Promise<number> {
    return this.prisma.booking.count({
      where: {
        userId,
        OR: [{ customerId: id }, { venueId: id }, { bookingAgentId: id }],
      },
    });
  }

  // The IDs of bookings this contact is the CUSTOMER of — the bookings whose checklist email
  // precondition depends on this contact's email (#618).
  async findCustomerBookingIds(userId: string, id: string): Promise<string[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { userId, customerId: id },
      select: { id: true },
    });
    return bookings.map((b) => b.id);
  }

  delete(id: string) {
    return this.prisma.contact.delete({ where: { id } });
  }
}
