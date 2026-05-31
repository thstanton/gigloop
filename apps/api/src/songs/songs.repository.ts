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
      orderBy: [{ artist: 'asc' }, { title: 'asc' }],
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

  async seedSongs(userId: string, entries: CatalogueEntry[]) {
    const existing = await this.prisma.song.findMany({
      where: { userId },
      select: { title: true, artist: true },
    });
    const existingKeys = new Set(existing.map((s) => `${s.title}|||${s.artist ?? ''}`));

    const toCreate = entries.filter(
      (e) => !existingKeys.has(`${e.title}|||${e.artist ?? ''}`),
    );

    if (toCreate.length === 0) return [];

    await this.prisma.song.createMany({
      data: toCreate.map((e) => ({
        userId,
        title: e.title,
        artist: e.artist ?? null,
        genre: e.genre,
        active: true,
        tags: [],
      })),
    });

    return this.prisma.song.findMany({
      where: {
        userId,
        title: { in: toCreate.map((e) => e.title) },
      },
      orderBy: [{ artist: 'asc' }, { title: 'asc' }],
    });
  }
}
