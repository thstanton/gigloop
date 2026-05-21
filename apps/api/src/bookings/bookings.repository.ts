import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';

const bookingIncludes = {
  customer: true,
  venue: true,
  referrer: true,
  sets: { orderBy: { order: 'asc' } },
  musicFormConfig: { select: { id: true } },
  musicFormResponse: { select: { id: true } },
} as const;

const listIncludes = {
  customer: { select: { id: true, name: true, email: true } },
  venue: { select: { id: true, name: true } },
  referrer: { select: { id: true, name: true } },
} as const;

@Injectable()
export class BookingsRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, status?: BookingStatus) {
    return this.prisma.booking.findMany({
      where: {
        userId,
        status: status !== undefined
          ? status
          : { not: BookingStatus.CANCELLED },
      },
      include: listIncludes,
      orderBy: { date: 'asc' },
    });
  }

  findOne(userId: string, id: string) {
    return this.prisma.booking.findFirst({
      where: { id, userId },
      include: bookingIncludes,
    });
  }

  create(userId: string, dto: CreateBookingDto) {
    const { sets, fee, ...fields } = dto;
    return this.prisma.booking.create({
      data: {
        userId,
        ...fields,
        ...(fee !== undefined ? { fee } : {}),
        sets: sets?.length
          ? { create: sets.map((s) => ({ userId, ...s })) }
          : undefined,
      },
      include: bookingIncludes,
    });
  }

  update(id: string, dto: UpdateBookingDto) {
    return this.prisma.booking.update({
      where: { id },
      data: dto,
      include: bookingIncludes,
    });
  }

  cancel(id: string) {
    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  findSet(userId: string, bookingId: string, setId: string) {
    return this.prisma.performanceSet.findFirst({
      where: { id: setId, bookingId, userId },
    });
  }

  addSet(userId: string, bookingId: string, dto: CreateSetDto) {
    return this.prisma.performanceSet.create({
      data: { userId, bookingId, ...dto },
    });
  }

  updateSet(setId: string, dto: UpdateSetDto) {
    return this.prisma.performanceSet.update({
      where: { id: setId },
      data: dto,
    });
  }

  deleteSet(setId: string) {
    return this.prisma.performanceSet.delete({
      where: { id: setId },
    });
  }
}
