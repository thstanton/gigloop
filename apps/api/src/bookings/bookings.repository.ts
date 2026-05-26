import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';

type FormatWithSlots = {
  id: string;
  label: string;
  keyMoments: string[];
  defaultGenreSelection: string[];
  slots: Array<{ label: string | null; duration: number; order: number }>;
};

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
    const { formatIds: _, fee, ...fields } = dto;
    return this.prisma.booking.create({
      data: {
        userId,
        ...fields,
        ...(fee !== undefined ? { fee } : {}),
      },
      include: bookingIncludes,
    });
  }

  findFormats(userId: string, ids: string[]) {
    return this.prisma.performanceFormat.findMany({
      where: { id: { in: ids }, userId },
      include: { slots: { orderBy: { order: 'asc' } } },
    });
  }

  createWithFormats(userId: string, dto: CreateBookingDto, orderedFormats: FormatWithSlots[]) {
    const { formatIds: _, fee, ...fields } = dto;

    let slotOrder = 1;
    const setRecords = orderedFormats.flatMap((fmt) =>
      fmt.slots.map((slot) => ({
        userId,
        order: slotOrder++,
        duration: slot.duration,
        label: slot.label ?? undefined,
        performanceFormatId: fmt.id,
      })),
    );

    const formatRecords = orderedFormats.map((fmt, idx) => ({
      userId,
      order: idx + 1,
      performanceFormatId: fmt.id,
    }));

    const allKeyMoments = orderedFormats.flatMap((fmt) =>
      fmt.keyMoments.map((km) => ({ label: km, section: fmt.label })),
    );
    const allGenres = [...new Set(orderedFormats.flatMap((fmt) => fmt.defaultGenreSelection))];

    return this.prisma.booking.create({
      data: {
        userId,
        ...fields,
        ...(fee !== undefined ? { fee } : {}),
        sets: setRecords.length ? { create: setRecords } : undefined,
        performanceFormats: { create: formatRecords },
        ...(allKeyMoments.length
          ? {
              musicFormConfig: {
                create: { userId, enabledGenres: allGenres, keyMoments: allKeyMoments },
              },
            }
          : {}),
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

  findBookingsForActions(userId: string, from: Date, to: Date) {
    return this.prisma.booking.findMany({
      where: {
        userId,
        status: { not: BookingStatus.CANCELLED },
        date: { gte: from, lte: to },
      },
      include: {
        customer: { select: { name: true } },
        venue: { select: { name: true } },
        invoices: { select: { isDeposit: true, status: true } },
        communications: {
          select: { status: true, template: { select: { builtInType: true } } },
        },
        musicFormConfig: { select: { id: true } },
        musicFormResponse: { select: { id: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  findUserProfile(userId: string) {
    return this.prisma.userProfile.findUnique({ where: { userId } });
  }
}
