import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';

const include = {
  contact: true,
  template: true,
} as const;

@Injectable()
export class CommunicationsRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, bookingId: string) {
    return this.prisma.communication.findMany({
      where: { userId, bookingId },
      include,
      orderBy: { sentAt: 'desc' },
    });
  }

  findOne(userId: string, bookingId: string, id: string) {
    return this.prisma.communication.findFirst({
      where: { id, userId, bookingId },
      include,
    });
  }

  findBookingById(userId: string, bookingId: string) {
    return this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { id: true },
    });
  }

  create(userId: string, bookingId: string, dto: CreateCommunicationDto) {
    return this.prisma.communication.create({
      data: {
        userId,
        bookingId,
        contactId: dto.contactId,
        subject: dto.subject,
        body: dto.body,
        ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
        ...(dto.sentAt !== undefined ? { sentAt: new Date(dto.sentAt) } : {}),
      },
      include,
    });
  }
}
