import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';

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
}
