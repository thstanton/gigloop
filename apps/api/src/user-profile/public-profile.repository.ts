import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePublicProfileDto } from './dto/update-public-profile.dto';

@Injectable()
export class PublicProfileRepository {
  constructor(private prisma: PrismaService) {}

  upsertByUserId(userId: string) {
    return this.prisma.publicProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  updateByUserId(userId: string, data: UpdatePublicProfileDto) {
    const { socials, ...rest } = data;
    const payload = {
      ...rest,
      ...(socials !== undefined
        ? { socials: socials === null ? Prisma.DbNull : socials }
        : {}),
    };
    return this.prisma.publicProfile.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload },
    });
  }
}
