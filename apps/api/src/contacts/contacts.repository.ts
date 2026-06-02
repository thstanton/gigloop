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
        customerBookings: { orderBy: { date: 'desc' } },
        venueBookings: { orderBy: { date: 'desc' } },
        bookingAgentBookings: { orderBy: { date: 'desc' } },
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

  delete(id: string) {
    return this.prisma.contact.delete({ where: { id } });
  }
}
