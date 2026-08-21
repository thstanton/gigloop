import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBandMutations } from './useBandMutations';
import { apiDelete, apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { bandMember } from '@/test/factories';
import type { BookingBandChair, BookingDetail } from '@/types/api';

vi.mock('@/lib/api', () => ({
  apiPost: vi.fn().mockResolvedValue({}),
  apiPatch: vi.fn().mockResolvedValue({}),
  apiDelete: vi.fn(),
}));
vi.mock('@/lib/hooks/use-toast', () => ({ toast: vi.fn() }));

const CHAIR_A: BookingBandChair = { id: 'ch-a', role: 'Sax', order: 1, packageId: null, memberId: null, callTime: null };
const CHAIR_B: BookingBandChair = { id: 'ch-b', role: 'Drums', order: 2, packageId: null, memberId: null, callTime: null };

const MEMBER_A = bandMember({ id: 'm-a', contactId: 'c-a', contact: { id: 'c-a', name: 'Dave' } });

/** Minimal cached booking — the optimistic edits only read .band.chairs / .band.members. */
function seededBooking(): BookingDetail {
  return { band: { chairs: [CHAIR_A, CHAIR_B], members: [] } } as unknown as BookingDetail;
}

/** A booking where CHAIR_A is filled by MEMBER_A — for the removeMember tests. */
function seededBookingWithMember(): BookingDetail {
  return {
    band: {
      chairs: [{ ...CHAIR_A, memberId: 'm-a' }, CHAIR_B],
      members: [MEMBER_A],
    },
  } as unknown as BookingDetail;
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

function setupWithMember() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const booking = seededBookingWithMember();
  client.setQueryData(['booking', 'b1'], booking);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useBandMutations('b1', booking.band.chairs), { wrapper });
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

  // Server-first (ADR-0072 §2): the resulting member row isn't known client-side until the
  // response comes back, so assignChair round-trips rather than editing the cache optimistically.
  it('assignChair PATCHes the assign endpoint with the contact id, then invalidates', async () => {
    vi.mocked(apiPatch).mockResolvedValue({});
    const { result } = setup();

    result.current.assignChair.mutate({ chairId: 'ch-a', contactId: 'c-x' });

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/bookings/b1/chairs/ch-a/assign', { contactId: 'c-x' }),
    );
  });

  it('assignChair with contactId: null vacates the chair', async () => {
    vi.mocked(apiPatch).mockResolvedValue({});
    const { result } = setup();

    result.current.assignChair.mutate({ chairId: 'ch-a', contactId: null });

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/bookings/b1/chairs/ch-a/assign', { contactId: null }),
    );
  });

  it('assignChair toasts on failure', async () => {
    vi.mocked(apiPatch).mockRejectedValue(new Error('boom'));
    const { result } = setup();

    result.current.assignChair.mutate({ chairId: 'ch-a', contactId: 'c-x' });

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to assign chair. Please try again.', variant: 'destructive' }),
      ),
    );
  });

  it('updateMemberStatus PATCHes the member endpoint with the new status', async () => {
    vi.mocked(apiPatch).mockResolvedValue({});
    const { result } = setupWithMember();

    result.current.updateMemberStatus.mutate({ memberId: 'm-a', status: 'CONFIRMED' });

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/bookings/b1/band-members/m-a', { status: 'CONFIRMED' }),
    );
  });

  it('saveMemberFee PATCHes the member endpoint with the fee', async () => {
    vi.mocked(apiPatch).mockResolvedValue({});
    const { result } = setupWithMember();

    result.current.saveMemberFee.mutate({ memberId: 'm-a', sessionFee: 200 });

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/bookings/b1/band-members/m-a', { sessionFee: 200 }),
    );
  });

  // Soft removal's result is fully known client-side (ADR-0072 §5): the member disappears AND
  // every chair it held reverts to a vacancy — this is optimistic, mirroring removeChair.
  it('removeMember removes the member and vacates their chairs before the delete request resolves', async () => {
    vi.mocked(apiDelete).mockReturnValue(new Promise(() => {}));
    const { result, cached } = setupWithMember();

    result.current.removeMember.mutate('m-a');

    await waitFor(() => expect(cached().band.members).toEqual([]));
    expect(cached().band.chairs.find((c) => c.id === 'ch-a')?.memberId).toBeNull();
    expect(apiDelete).toHaveBeenCalledWith('/bookings/b1/band-members/m-a');
  });

  it('rolls back the cache and toasts when removing a member fails', async () => {
    vi.mocked(apiDelete).mockRejectedValue(new Error('boom'));
    const { result, cached } = setupWithMember();

    result.current.removeMember.mutate('m-a');

    await waitFor(() => expect(cached().band.members).toEqual([MEMBER_A]));
    expect(cached().band.chairs.find((c) => c.id === 'ch-a')?.memberId).toBe('m-a');
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to remove member. Please try again.', variant: 'destructive' }),
    );
  });
});
