import { Injectable } from '@nestjs/common';
import { CommunicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';

const include = {
  contact: true,
  template: true,
  document: { select: { id: true, invoiceId: true } },
} as const;

@Injectable()
export class CommunicationsRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, bookingId: string) {
    return this.prisma.communication.findMany({
      where: { userId, bookingId },
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  findTemplate(userId: string, templateId: string) {
    return this.prisma.template.findFirst({
      where: { id: templateId, userId },
      select: { id: true, name: true, builtInType: true, content: true },
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
        status: CommunicationStatus.SENT,
        sentAt: dto.sentAt ? new Date(dto.sentAt) : new Date(),
        ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
      },
      include,
    });
  }

  createPending(
    userId: string,
    bookingId: string,
    contactId: string,
    subject: string,
    body: string,
    templateId?: string,
    documentId?: string,
  ) {
    return this.prisma.communication.create({
      data: {
        userId,
        bookingId,
        contactId,
        subject,
        body,
        status: CommunicationStatus.PENDING,
        ...(templateId ? { templateId } : {}),
        ...(documentId ? { documentId } : {}),
      },
    });
  }

  markSent(id: string) {
    return this.prisma.communication.update({
      where: { id },
      data: { status: CommunicationStatus.SENT, sentAt: new Date() },
    });
  }

  markFailed(id: string) {
    return this.prisma.communication.update({
      where: { id },
      data: { status: CommunicationStatus.FAILED },
    });
  }
}
