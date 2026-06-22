import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useItineraryMutations } from './useItineraryMutations';
import { apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { BookingDetail, PerformanceSet } from '@/types/api';

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn().mockResolvedValue({}),
  apiPatch: vi.fn().mockResolvedValue({}),
  apiDelete: vi.fn(),
}));
vi.mock('@/lib/hooks/use-toast', () => ({ toast: vi.fn() }));

const SET_A: PerformanceSet = { id: 'sa', order: 1, duration: 30, startTime: null, label: 'A', packageId: 'pkg1' };
const SET_B: PerformanceSet = { id: 'sb', order: 2, duration: 30, startTime: null, label: 'B', packageId: null };

/** Minimal cached booking — the optimistic edits only read .sets and .packages. */
function seededBooking(): BookingDetail {
  return {
    sets: [SET_A, SET_B],
    packages: [{ id: 'pkg1', order: 1, label: 'Ceremony', icon: 'music' }],
  } as unknown as BookingDetail;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['booking', 'b1'], seededBooking());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useItineraryMutations('b1', [SET_A, SET_B]), { wrapper });
  const cached = () => client.getQueryData<BookingDetail>(['booking', 'b1'])!;
  return { result, cached };
}

describe('useItineraryMutations — optimistic updates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes a set from the cache before the delete request resolves', async () => {
    // A never-resolving request: the only thing that can drop the row is the optimistic onMutate.
    vi.mocked(apiDelete).mockReturnValue(new Promise(() => {}));
    const { result, cached } = setup();

    result.current.deleteSet.mutate('sa');

    await waitFor(() => expect(cached().sets.map((s) => s.id)).toEqual(['sb']));
    expect(apiDelete).toHaveBeenCalledWith('/bookings/b1/sets/sa');
  });

  it('removing a package drops it and re-parents its sets to ungrouped, before the request resolves', async () => {
    vi.mocked(apiDelete).mockReturnValue(new Promise(() => {}));
    const { result, cached } = setup();

    result.current.removePackage.mutate('pkg1');

    await waitFor(() => expect(cached().packages).toHaveLength(0));
    // SET_A was in pkg1 — it must now be ungrouped, not left with a dangling packageId.
    expect(cached().sets.find((s) => s.id === 'sa')?.packageId).toBeNull();
  });

  it('rolls back the cache and toasts when a delete fails', async () => {
    vi.mocked(apiDelete).mockRejectedValue(new Error('boom'));
    const { result, cached } = setup();

    result.current.deleteSet.mutate('sa');

    // The optimistic removal is reverted to the snapshot…
    await waitFor(() => expect(cached().sets.map((s) => s.id)).toEqual(['sa', 'sb']));
    // …and the failure surfaces as a destructive toast.
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to delete set. Please try again.', variant: 'destructive' }),
    );
  });
});
