import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

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

  updateByUserId(userId: string, data: UpdateUserProfileDto) {
    return this.prisma.userProfile.update({
      where: { userId },
      data,
    });
  }
}
