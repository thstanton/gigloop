import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDismissibleHint } from './useDismissibleHint';
import { apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { UserProfile } from '@/types/api';

vi.mock('@/lib/api', () => ({ apiPatch: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/hooks/use-toast', () => ({ toast: vi.fn() }));

const hoisted = vi.hoisted(() => ({ me: undefined as UserProfile | undefined }));
vi.mock('@/lib/hooks/useMe', () => ({ useMe: () => ({ data: hoisted.me }) }));

/** Minimal cached profile — the hook only reads .preferences.dismissedHints. */
function profile(dismissedHints: string[], extra: Record<string, unknown> = {}): UserProfile {
  return { preferences: { reminderLeadDays: 7, ...extra, dismissedHints } } as unknown as UserProfile;
}

function setup(id: string, seeded: UserProfile | undefined) {
  hoisted.me = seeded;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (seeded) client.setQueryData(['me'], seeded);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDismissibleHint(id), { wrapper });
  const cachedHints = () =>
    client.getQueryData<UserProfile>(['me'])?.preferences?.dismissedHints;
  const cachedPrefs = () => client.getQueryData<UserProfile>(['me'])?.preferences;
  return { result, cachedHints, cachedPrefs };
}

describe('useDismissibleHint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports isDismissed per id — one dismissal does not affect unrelated ids', () => {
    const seeded = profile(['booking-concept-card']);
    expect(setup('booking-concept-card', seeded).result.current.isDismissed).toBe(true);
    expect(setup('home-address-missing', seeded).result.current.isDismissed).toBe(false);
  });

  it('optimistically appends the id to the cache (deduped, other prefs preserved) and sends the full array', async () => {
    vi.mocked(apiPatch).mockReturnValue(new Promise(() => {})); // never resolves — only onMutate can change the cache
    const { result, cachedHints, cachedPrefs } = setup('b', profile(['a'], { customDressCodeOptions: ['Black tie'] }));

    result.current.dismiss();

    await waitFor(() => expect(cachedHints()).toEqual(['a', 'b']));
    expect(cachedPrefs()?.reminderLeadDays).toBe(7);
    expect(cachedPrefs()?.customDressCodeOptions).toEqual(['Black tie']);
    expect(apiPatch).toHaveBeenCalledWith('/me', { preferences: { dismissedHints: ['a', 'b'] } });
  });

  it('rolls back the cache and toasts when the save fails', async () => {
    vi.mocked(apiPatch).mockRejectedValue(new Error('boom'));
    const { result, cachedHints } = setup('b', profile(['a']));

    result.current.dismiss();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    );
    expect(cachedHints()).toEqual(['a']);
  });
});
