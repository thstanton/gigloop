import { Injectable } from '@nestjs/common';
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
    return this.prisma.publicProfile.update({
      where: { userId },
      data,
    });
  }
}
