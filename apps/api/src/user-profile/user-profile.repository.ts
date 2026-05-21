import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { encrypt, decrypt } from '../common/crypto';

@Injectable()
export class UserProfileRepository {
  constructor(private prisma: PrismaService) {}

  async upsertByUserId(userId: string) {
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return this.decryptProfile(profile);
  }

  async updateByUserId(userId: string, data: UpdateUserProfileDto) {
    const payload = { ...data };
    if (payload.bankDetails !== undefined && payload.bankDetails !== null) {
      payload.bankDetails = encrypt(payload.bankDetails);
    }
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload },
    });
    return this.decryptProfile(profile);
  }

  private decryptProfile(profile: { bankDetails: string | null;[key: string]: unknown }) {
    return {
      ...profile,
      bankDetails: profile.bankDetails ? decrypt(profile.bankDetails) : null,
    };
  }
}
