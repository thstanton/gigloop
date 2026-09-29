import { UserProfileService } from './user-profile.service';
import { UserProfileRepository } from './user-profile.repository';
import { applyBandSoloOptOut } from '../checklist/checklist-defaults';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let repo: {
    upsertByUserId: jest.Mock;
    updateByUserId: jest.Mock;
    updateChecklistDefaults: jest.Mock;
  };

  beforeEach(() => {
    repo = {
      upsertByUserId: jest.fn(),
      updateByUserId: jest.fn(),
      updateChecklistDefaults: jest.fn(),
    };
    service = new UserProfileService(repo as unknown as UserProfileRepository);
  });

  it('persists a custom item\'s concern through to the repository (#561)', () => {
    service.updateChecklistDefaults('u1', {
      customItems: [
        { label: 'Book parking', completedBy: 'USER', concern: 'venue' },
      ],
    });

    expect(repo.updateChecklistDefaults).toHaveBeenCalledWith(
      'u1',
      [],
      [expect.objectContaining({ key: null, label: 'Book parking', concern: 'venue' })],
      undefined,
    );
  });

  it('defaults a concern-less custom to a null concern', () => {
    service.updateChecklistDefaults('u1', {
      customItems: [{ label: 'Charge the camera', completedBy: 'USER' }],
    });

    expect(repo.updateChecklistDefaults).toHaveBeenCalledWith(
      'u1',
      [],
      [expect.objectContaining({ concern: null })],
      undefined,
    );
  });

  it('uses the shared opt-out helper for the onboarding solo answer', async () => {
    const preferences = {
      theme: 'dark',
      checklistDefaults: {
        systemItemOverrides: [{ key: 'get_the_quote_accepted', enabled: false }],
        customItems: [{ label: 'Custom reminder' }],
      },
    };
    repo.upsertByUserId.mockResolvedValue({ preferences });

    await service.disableBandChecklistGoals('u1');

    expect(repo.upsertByUserId).toHaveBeenCalledWith('u1');
    expect(repo.updateByUserId).toHaveBeenCalledWith('u1', {
      preferences: applyBandSoloOptOut(preferences),
    });
  });
});
