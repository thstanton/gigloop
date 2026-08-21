import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBandMutations } from './useBandMutations';
import { apiDelete, apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { BookingBandChair, BookingDetail } from '@/types/api';

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn().mockResolvedValue({}),
  apiPatch: vi.fn().mockResolvedValue({}),
  apiDelete: vi.fn(),
}));
vi.mock('@/lib/hooks/use-toast', () => ({ toast: vi.fn() }));

const CHAIR_A: BookingBandChair = { id: 'ch-a', role: 'Sax', order: 1, packageId: null, memberId: null, callTime: null };
const CHAIR_B: BookingBandChair = { id: 'ch-b', role: 'Drums', order: 2, packageId: null, memberId: null, callTime: null };

/** Minimal cached booking — the optimistic edits only read .band.chairs. */
function seededBooking(): BookingDetail {
  return { band: { chairs: [CHAIR_A, CHAIR_B] } } as unknown as BookingDetail;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['booking', 'b1'], seededBooking());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useBandMutations('b1', [CHAIR_A, CHAIR_B]), { wrapper });
  const cached = () => client.getQueryData<BookingDetail>(['booking', 'b1'])!;
  return { result, cached };
}

describe('useBandMutations — optimistic updates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes a chair from the cache before the delete request resolves', async () => {
    vi.mocked(apiDelete).mockReturnValue(new Promise(() => {}));
    const { result, cached } = setup();

    result.current.removeChair.mutate('ch-a');

    await waitFor(() => expect(cached().band.chairs.map((c) => c.id)).toEqual(['ch-b']));
    expect(apiDelete).toHaveBeenCalledWith('/bookings/b1/chairs/ch-a');
  });

  it('rolls back the cache and toasts when removing a chair fails', async () => {
    vi.mocked(apiDelete).mockRejectedValue(new Error('boom'));
    const { result, cached } = setup();

    result.current.removeChair.mutate('ch-a');

    await waitFor(() => expect(cached().band.chairs.map((c) => c.id)).toEqual(['ch-a', 'ch-b']));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to remove chair. Please try again.', variant: 'destructive' }),
    );
  });

  it('edits a chair role in the cache before the PATCH request resolves', async () => {
    vi.mocked(apiPatch).mockReturnValue(new Promise(() => {}));
    const { result, cached } = setup();

    result.current.updateChair.mutate({ chairId: 'ch-a', dto: { role: 'Trumpet' } });

    await waitFor(() => expect(cached().band.chairs.find((c) => c.id === 'ch-a')?.role).toBe('Trumpet'));
  });

  it('rolls back and toasts when updating a chair fails', async () => {
    vi.mocked(apiPatch).mockRejectedValue(new Error('boom'));
    const { result, cached } = setup();

    result.current.updateChair.mutate({ chairId: 'ch-a', dto: { role: 'Trumpet' } });

    await waitFor(() => expect(cached().band.chairs.find((c) => c.id === 'ch-a')?.role).toBe('Sax'));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to update chair. Please try again.', variant: 'destructive' }),
    );
  });

  // Advisor review, #884: without a single up-front optimistic write, the two PATCHes moveChair
  // fires could interleave and briefly render a half-swapped order — this asserts the swap lands
  // atomically, before either request has a chance to resolve.
  it('moveChair swaps both chairs\' order synchronously, before either PATCH resolves', async () => {
    vi.mocked(apiPatch).mockReturnValue(new Promise(() => {}));
    const { result, cached } = setup();

    result.current.moveChair('ch-b', 'up');

    // The swap is visible immediately — synchronously, not after a round-trip.
    expect(cached().band.chairs.find((c) => c.id === 'ch-a')?.order).toBe(2);
    expect(cached().band.chairs.find((c) => c.id === 'ch-b')?.order).toBe(1);

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/bookings/b1/chairs/ch-a', { order: 2 }));
    expect(apiPatch).toHaveBeenCalledWith('/bookings/b1/chairs/ch-b', { order: 1 });
  });

  it('moveChair is a no-op past either end of the list', () => {
    vi.mocked(apiPatch).mockResolvedValue({});
    const { result, cached } = setup();

    result.current.moveChair('ch-a', 'up');
    result.current.moveChair('ch-b', 'down');

    expect(cached().band.chairs.map((c) => c.order)).toEqual([1, 2]);
    expect(apiPatch).not.toHaveBeenCalled();
  });
});
