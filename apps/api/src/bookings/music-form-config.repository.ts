import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertMusicFormConfigDto } from './dto/upsert-music-form-config.dto';

@Injectable()
export class MusicFormConfigRepository {
  constructor(private prisma: PrismaService) {}

  findMusicFormConfig(bookingId: string) {
    return this.prisma.musicFormConfig.findUnique({ where: { bookingId } });
  }

  findMusicFormResponse(userId: string, bookingId: string) {
    return this.prisma.musicFormResponse.findUnique({
      where: { bookingId },
      select: {
        selectedSongIds: true,
        specialRequests: true,
        notes: true,
        submittedAt: true,
        booking: { select: { userId: true } },
      },
    });
  }

  upsertMusicFormConfig(userId: string, bookingId: string, dto: UpsertMusicFormConfigDto) {
    return this.prisma.musicFormConfig.upsert({
      where: { bookingId },
      create: { userId, bookingId, keyMoments: dto.keyMoments as unknown as Prisma.InputJsonValue, enabledGenres: dto.enabledGenres },
      update: { keyMoments: dto.keyMoments as unknown as Prisma.InputJsonValue, enabledGenres: dto.enabledGenres },
    });
  }

  deleteMusicFormConfig(bookingId: string) {
    return this.prisma.musicFormConfig.delete({ where: { bookingId } });
  }

  findSongsByIds(userId: string, ids: string[]) {
    return this.prisma.song.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, title: true, artist: true, genre: true },
    });
  }

  upsertMusicFormResponse(
    bookingId: string,
    userId: string,
    selectedSongIds: string[],
    specialRequests: readonly unknown[],
    notes: string | undefined,
  ) {
    return this.prisma.musicFormResponse.upsert({
      where: { bookingId },
      create: {
        bookingId,
        userId,
        selectedSongIds,
        specialRequests: specialRequests as unknown as Prisma.InputJsonValue,
        notes,
        submittedAt: new Date(),
      },
      update: {
        selectedSongIds,
        specialRequests: specialRequests as unknown as Prisma.InputJsonValue,
        notes,
        submittedAt: new Date(),
      },
    });
  }

  findBookingForSongList(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        title: true,
        date: true,
        customer: { select: { name: true } },
        venue: { select: { name: true } },
      },
    });
  }
}
