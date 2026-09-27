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

const CHAIR_A: BookingBandChair = { id: 'ch-a', role: 'Sax', order: 1, lineupId: 'lu1', memberId: null, callTimes: [] };
const CHAIR_B: BookingBandChair = { id: 'ch-b', role: 'Drums', order: 2, lineupId: 'lu1', memberId: null, callTimes: [] };

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
  const { result } = renderHook(() => useBandMutations('b1'), { wrapper });
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
  const { result } = renderHook(() => useBandMutations('b1'), { wrapper });
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

});
