import { BadRequestException, Injectable } from '@nestjs/common';
import { UserProfileRepository } from './user-profile.repository';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateChecklistDefaultsDto } from './dto/update-checklist-defaults.dto';
import { CHECKLIST_DEFAULTS, getChecklistDefaults } from '../bookings/checklist-defaults';
import type { ChecklistDefaultItem } from '../bookings/checklist-defaults';

const SYSTEM_KEYS = new Set(CHECKLIST_DEFAULTS.map((d) => d.key));

@Injectable()
export class UserProfileService {
  constructor(private repo: UserProfileRepository) {}

  async findOrCreate(userId: string) {
    const profile = await this.repo.upsertByUserId(userId);
    const prefs = (profile.preferences ?? {}) as Record<string, unknown>;
    const checklistDefaults = getChecklistDefaults(prefs);
    return {
      ...profile,
      preferences: {
        ...prefs,
        checklistDefaults,
      },
    };
  }

  update(userId: string, dto: UpdateUserProfileDto) {
    return this.repo.updateByUserId(userId, dto);
  }

  updateChecklistDefaults(userId: string, dto: UpdateChecklistDefaultsDto) {
    // Validate system item keys exist
    for (const override of dto.systemItemOverrides ?? []) {
      if (!SYSTEM_KEYS.has(override.key)) {
        throw new BadRequestException(`Unknown system item key: ${override.key}`);
      }
    }

    const customItems: ChecklistDefaultItem[] = (dto.customItems ?? []).map((item) => ({
      key: null as unknown as string, // custom items have no key
      label: item.label,
      completedBy: item.completedBy,
      dependsOn: [],
      autoCompleteRule: null,
      requiredForStatus: item.requiredForStatus ?? null,
      dueDateRule: item.dueDateRule ?? null,
      ...(item.enabled === false ? { enabled: false } : {}),
    }));

    return this.repo.updateChecklistDefaults(
      userId,
      dto.systemItemOverrides ?? [],
      customItems,
      dto.reminderLeadDays,
    );
  }
}
