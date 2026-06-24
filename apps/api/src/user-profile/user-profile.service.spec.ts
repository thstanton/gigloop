import { UserProfileService } from './user-profile.service';
import { UserProfileRepository } from './user-profile.repository';

describe('UserProfileService.updateChecklistDefaults', () => {
  let service: UserProfileService;
  let repo: { updateChecklistDefaults: jest.Mock };

  beforeEach(() => {
    repo = { updateChecklistDefaults: jest.fn() };
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
});
