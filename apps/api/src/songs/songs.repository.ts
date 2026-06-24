import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import type { CatalogueEntry } from './song-catalogue';

@Injectable()
export class SongsRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, genre?: string, active?: boolean) {
    return this.prisma.song.findMany({
      where: {
        userId,
        ...(genre !== undefined ? { genre } : {}),
        ...(active !== undefined ? { active } : {}),
      },
      orderBy: [{ title: 'asc' }, { artist: 'asc' }],
    });
  }

  findOne(userId: string, id: string) {
    return this.prisma.song.findFirst({
      where: { id, userId },
    });
  }

  create(userId: string, dto: CreateSongDto) {
    return this.prisma.song.create({
      data: { userId, ...dto },
    });
  }

  update(id: string, dto: UpdateSongDto) {
    return this.prisma.song.update({
      where: { id },
      data: dto,
    });
  }

  delete(id: string) {
    return this.prisma.song.delete({
      where: { id },
    });
  }

  findByGenres(userId: string, genres: string[]) {
    return this.prisma.song.findMany({
      where: { userId, genre: { in: genres }, active: true },
      select: { id: true, title: true, artist: true, genre: true },
      orderBy: [{ genre: 'asc' }, { title: 'asc' }],
    });
  }

  findByIds(userId: string, ids: string[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.prisma.song.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, title: true, artist: true, genre: true },
    });
  }

  async seedSongs(userId: string, entries: CatalogueEntry[]) {
    if (entries.length === 0) return [];

    const existing = await this.prisma.song.findMany({
      where: { userId, title: { in: entries.map((e) => e.title) } },
      select: { title: true, artist: true },
    });
    const existingKeys = new Set(existing.map((s) => JSON.stringify([s.title, s.artist ?? ''])));

    const toCreate = entries.filter(
      (e) => !existingKeys.has(JSON.stringify([e.title, e.artist ?? ''])),
    );

    if (toCreate.length === 0) return [];

    return this.prisma.song.createManyAndReturn({
      data: toCreate.map((e) => ({
        userId,
        title: e.title,
        artist: e.artist ?? null,
        genre: e.genre,
        active: true,
        tags: [],
      })),
    });
  }
}
