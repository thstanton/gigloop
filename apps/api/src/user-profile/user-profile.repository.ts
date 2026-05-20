import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserProfileRepository {
  constructor(private prisma: PrismaService) {}

  upsertByUserId(userId: string) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, businessName: '' },
    });
  }
}
