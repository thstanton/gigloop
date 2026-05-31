import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { encrypt, decrypt } from '../common/crypto';
import type { ChecklistDefaultItem } from '../bookings/checklist-defaults';

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
    return this.decryptProfile(profile);
  }

  async updateChecklistDefaults(
    userId: string,
    systemItemOverrides: Array<{ key: string; enabled?: boolean; dueDateRule?: unknown }>,
    customItems: ChecklistDefaultItem[],
    reminderLeadDays?: number,
  ) {
    const existing = await this.prisma.userProfile.findUnique({ where: { userId } });
    const prefs = (existing?.preferences ?? {}) as Record<string, unknown>;

    // Merge systemItemOverrides into existing checklistDefaults
    const { CHECKLIST_DEFAULTS } = await import('../bookings/checklist-defaults');
    const existingDefaults = Array.isArray(prefs.checklistDefaults)
      ? (prefs.checklistDefaults as ChecklistDefaultItem[])
      : CHECKLIST_DEFAULTS;

    const overrideMap = new Map(systemItemOverrides.map((o) => [o.key, o]));

    const updatedSystemItems = CHECKLIST_DEFAULTS.map((defaultItem) => {
      const existingItem = existingDefaults.find((d) => d.key === defaultItem.key) ?? defaultItem;
      const override = overrideMap.get(defaultItem.key);
      const merged: ChecklistDefaultItem = {
        ...existingItem,
        dueDateRule: override?.dueDateRule !== undefined
          ? (override.dueDateRule as ChecklistDefaultItem['dueDateRule'])
          : existingItem.dueDateRule,
      };
      if (override?.enabled !== undefined) {
        merged.enabled = override.enabled === false ? false : undefined;
      }
      return merged;
    });

    const newDefaults = [...updatedSystemItems, ...customItems];

    const newPrefs: Record<string, unknown> = {
      ...prefs,
      checklistDefaults: newDefaults,
    };
    if (reminderLeadDays !== undefined) {
      newPrefs.reminderLeadDays = reminderLeadDays;
    }

    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: { preferences: newPrefs as any },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
