import { ChecklistRepository } from './checklist.repository';
import { BAND_BRIEFED_GOAL_KEY, BAND_CHECKLIST_GOAL_KEY } from './checklist-defaults';
import { ChecklistSoloService, planBandSoloExit } from './checklist-solo.service';

describe('ChecklistSoloService (#902)', () => {
  let repository: { applyBandSoloExit: jest.Mock };
  let service: ChecklistSoloService;

  beforeEach(() => {
    repository = { applyBandSoloExit: jest.fn() };
    service = new ChecklistSoloService(repository as unknown as ChecklistRepository);
  });

  it('delegates one atomic repository operation', async () => {
    repository.applyBandSoloExit.mockResolvedValue(true);

    await expect(service.playSolo('u1', 'b1')).resolves.toBe(true);
    expect(repository.applyBandSoloExit).toHaveBeenCalledWith('u1', 'b1', planBandSoloExit);
  });

  it('does not plan a write when there is no band goal', () => {
    expect(planBandSoloExit({ goals: [], preferences: {} })).toBeNull();
  });

  it('preserves completed history and skips outstanding band goals while updating defaults', () => {
    expect(planBandSoloExit({
      goals: [
        { id: 'g-band', state: 'COMPLETE' },
        { id: 'g-brief', state: 'PENDING' },
      ],
      preferences: { theme: 'dark' },
    })).toMatchObject({
      goalIdsToSkip: ['g-brief'],
      preferences: {
        theme: 'dark',
        onboardingSkippedBandSetup: false,
        checklistDefaults: {
          systemItemOverrides: expect.arrayContaining([
            { key: BAND_CHECKLIST_GOAL_KEY, enabled: false },
            { key: BAND_BRIEFED_GOAL_KEY, enabled: false },
          ]),
        },
      },
    });
  });
});
