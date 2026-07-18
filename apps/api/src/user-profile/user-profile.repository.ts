import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { encrypt, decrypt } from '../common/crypto';
import type { ChecklistDefaultItem, DueDateRule } from '../bookings/checklist-defaults';

const USER_PROFILE_ADDRESS_FIELDS: ReadonlyArray<keyof UpdateUserProfileDto> = [
  'addressLine1', 'addressLine2', 'city', 'county', 'postcode', 'country',
  'latitude', 'longitude', 'placeId',
];

const TRAVEL_TIME_CLEAR = {
  travelTimeMinutes: null,
  travelDistanceMetres: null,
  travelTimeCalculatedAt: null,
  travelMode: null,
} as const;

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
    const { preferences, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (payload.bankDetails !== undefined && payload.bankDetails !== null) {
      payload.bankDetails = encrypt(payload.bankDetails as string);
    }

    if (preferences !== undefined) {
      const existing = await this.prisma.userProfile.findUnique({ where: { userId } });
      const merged = { ...(existing?.preferences as Record<string, unknown> ?? {}), ...preferences };
      payload.preferences = merged;
    }

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload },
    });

    if (USER_PROFILE_ADDRESS_FIELDS.some((f) => f in data)) {
      await this.prisma.contact.updateMany({
        where: { userId },
        data: TRAVEL_TIME_CLEAR,
      });
    }

    return this.decryptProfile(profile);
  }

  // ADR-0060: store only the musician's SPARSE overrides against the catalogue, never a
  // materialised snapshot. The effective template is derived on read (getChecklistDefaults).
  async updateChecklistDefaults(
    userId: string,
    systemItemOverrides: Array<{ key: string; enabled?: boolean; dueDateRule?: DueDateRule | null }>,
    customItems: ChecklistDefaultItem[],
    reminderLeadDays?: number,
  ) {
    const existing = await this.prisma.userProfile.findUnique({ where: { userId } });
    const prefs = (existing?.preferences ?? {}) as Record<string, unknown>;

    // Persist only deltas that differ from the current catalogue default (drops no-op
    // overrides and any retired key). The incoming DTO may carry every key; we sparsify here.
    const { sparsifySystemOverrides } = await import('../bookings/checklist-defaults');
    const checklistDefaults = {
      systemItemOverrides: sparsifySystemOverrides(systemItemOverrides),
      customItems,
    };

    const newPrefs: Record<string, unknown> = { ...prefs, checklistDefaults };
    if (reminderLeadDays !== undefined) {
      newPrefs.reminderLeadDays = reminderLeadDays;
    }

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma Json column
      update: { preferences: newPrefs as any },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma Json column
      create: { userId, preferences: newPrefs as any },
    });
    return this.decryptProfile(profile);
  }

  async completeOnboarding(userId: string) {
    const existing = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (existing?.onboardingCompletedAt) {
      return this.decryptProfile(existing);
    }
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      update: { onboardingCompletedAt: new Date() },
      create: { userId, onboardingCompletedAt: new Date() },
    });
    return this.decryptProfile(profile);
  }

  private decryptProfile(profile: { bankDetails: string | null; [key: string]: unknown }): { bankDetails: string | null; [key: string]: unknown } {
    return {
      ...profile,
      bankDetails: profile.bankDetails ? decrypt(profile.bankDetails) : null,
    };
  }
}
