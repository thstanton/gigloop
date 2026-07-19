import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBookingNewData } from './useBookingNewData';
import { apiGet } from '@/lib/api';
import type { UserProfile } from '@/types/api';

// Clerk is initialised so the profile query is enabled.
vi.mock('@clerk/react', () => ({ useAuth: () => ({ isLoaded: true }) }));
vi.mock('@/lib/api', () => ({ apiGet: vi.fn() }));

// A profile whose default status (PROVISIONAL) differs from the user's pick (CONFIRMED), so a
// clobbering seed would be observable as setValue('status', 'PROVISIONAL').
const profile = {
  id: 'u1',
  songRequestFormEnabled: true,
  preferences: { defaultBookingStatus: 'PROVISIONAL' },
} as unknown as UserProfile;

function mockApi() {
  vi.mocked(apiGet).mockImplementation((path: string) => {
    if (path === '/me') return Promise.resolve(profile);
    return Promise.resolve([]); // /packages, /series, reminder preview
  });
}

function render(params: { isStatusDirty: boolean; isMusicFormDirty: boolean }) {
  const setValue = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  renderHook(
    () => useBookingNewData({ previewStatus: 'CONFIRMED', setValue, ...params }),
    { wrapper },
  );
  return setValue;
}

describe('useBookingNewData — profile-default seed does not clobber user input (#730)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('does NOT overwrite a status the user has already picked when /me resolves late', async () => {
    const setValue = render({ isStatusDirty: true, isMusicFormDirty: false });

    // The music-form seed (not dirty) proves the effect ran once the profile resolved…
    await waitFor(() => expect(setValue).toHaveBeenCalledWith('enableMusicForm', true));
    // …yet the user's status pick was left untouched — no revert to the profile default.
    expect(setValue).not.toHaveBeenCalledWith('status', expect.anything());
  });

  it('seeds the profile default into an untouched status field', async () => {
    const setValue = render({ isStatusDirty: false, isMusicFormDirty: false });

    await waitFor(() => expect(setValue).toHaveBeenCalledWith('status', 'PROVISIONAL'));
  });

  it('does NOT overwrite a music-form toggle the user has already changed', async () => {
    const setValue = render({ isStatusDirty: false, isMusicFormDirty: true });

    // The status seed (not dirty) confirms the effect ran…
    await waitFor(() => expect(setValue).toHaveBeenCalledWith('status', 'PROVISIONAL'));
    // …while the user's music-form toggle was preserved.
    expect(setValue).not.toHaveBeenCalledWith('enableMusicForm', expect.anything());
  });
});
