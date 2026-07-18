import { BadRequestException, Injectable } from '@nestjs/common';
import { UserProfileRepository } from './user-profile.repository';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateChecklistDefaultsDto } from './dto/update-checklist-defaults.dto';
import { getChecklistDefaults } from '../bookings/checklist-defaults';
import type { ChecklistDefaultItem } from '../bookings/checklist-defaults';

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
    if (dto.preferences?.customDressCodeOptions !== undefined) {
      const raw = dto.preferences.customDressCodeOptions;
      if (!Array.isArray(raw) || (raw as unknown[]).some((v) => typeof v !== 'string' || !(v as string).trim())) {
        throw new BadRequestException('customDressCodeOptions must be an array of non-empty strings');
      }
      dto.preferences.customDressCodeOptions = [
        ...new Set((raw as string[]).map((v) => v.trim()).filter(Boolean)),
      ];
    }
    return this.repo.updateByUserId(userId, dto);
  }

  completeOnboarding(userId: string) {
    return this.repo.completeOnboarding(userId);
  }

  updateChecklistDefaults(userId: string, dto: UpdateChecklistDefaultsDto) {
    // ADR-0060: no unknown-key rejection — the writer sparsifies against the current catalogue
    // and silently drops any retired key (symmetric with read-merge drop-on-read), so a stale
    // client posting a since-retired key never 400s.
    const customItems: ChecklistDefaultItem[] = (dto.customItems ?? []).map((item) => ({
      key: null as unknown as string, // custom items have no key
      label: item.label,
      completedBy: item.completedBy,
      dependsOn: [],
      autoCompleteRule: null,
      requiredForStatus: item.requiredForStatus ?? null,
      dueDateRule: item.dueDateRule ?? null,
      concern: item.concern ?? null,
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
