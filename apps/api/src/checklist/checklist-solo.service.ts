import { Injectable } from '@nestjs/common';
import { applyBandSoloOptOut } from './checklist-defaults';
import { ChecklistRepository } from './checklist.repository';
import type { BandSoloExitContext, BandSoloExitPlan } from './checklist.repository';

export function planBandSoloExit(context: BandSoloExitContext): BandSoloExitPlan | null {
  if (context.goals.length === 0) return null;

  return {
    // Preserve completed history; the exit only clears band work that is still outstanding.
    goalIdsToSkip: context.goals
      .filter((goal) => goal.state !== 'SKIPPED' && goal.state !== 'COMPLETE')
      .map((goal) => goal.id),
    preferences: applyBandSoloOptOut(context.preferences),
  };
}

@Injectable()
export class ChecklistSoloService {
  constructor(private readonly checklistRepository: ChecklistRepository) {}

  playSolo(userId: string, bookingId: string): Promise<boolean> {
    return this.checklistRepository.applyBandSoloExit(userId, bookingId, planBandSoloExit);
  }
}
