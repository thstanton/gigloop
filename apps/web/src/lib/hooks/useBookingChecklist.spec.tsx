import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBookingChecklist } from './useBookingChecklist';
import { apiPatch } from '@/lib/api';
import type { BookingDetail, ChecklistItem } from '@/types/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPost: vi.fn().mockResolvedValue({}),
  apiPatch: vi.fn(),
}));
vi.mock('@/lib/hooks/use-toast', () => ({ toast: vi.fn() }));

function item(overrides: Partial<ChecklistItem> & Pick<ChecklistItem, 'id' | 'state'>): ChecklistItem {
  return {
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    bookingId: 'b1',
    key: null,
    label: 'Item',
    completedBy: 'USER',
    order: 0,
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: null,
    completedAt: null,
    dueDate: null,
    dueDateRule: null,
    concern: null,
    ...overrides,
  };
}

const booking = { id: 'b1', status: 'CONFIRMED' } as unknown as BookingDetail;

function setup(initial: ChecklistItem[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['bookingChecklist', 'b1'], initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useBookingChecklist('b1', booking, true), { wrapper });
  const cached = () => client.getQueryData<ChecklistItem[]>(['bookingChecklist', 'b1'])!;
  return { result, cached };
}

describe('useBookingChecklist — toggle stale-response guard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a slow earlier response does not clobber a newer rapid toggle of the same item', async () => {
    // Each call returns a controllable deferred so we can resolve out of order.
    const resolvers: Array<(v: ChecklistItem[]) => void> = [];
    vi.mocked(apiPatch).mockImplementation(
      () => new Promise<ChecklistItem[]>((resolve) => resolvers.push(resolve)),
    );

    const { result, cached } = setup([item({ id: 'i1', state: 'PENDING' })]);

    // Three rapid toggles of the same item → seq 1, 2, 3.
    act(() => {
      result.current.toggleItem('i1', 'COMPLETE');
      result.current.toggleItem('i1', 'PENDING');
      result.current.toggleItem('i1', 'COMPLETE');
    });

    await waitFor(() => expect(resolvers).toHaveLength(3));

    const resp = (n: number): ChecklistItem[] => [item({ id: 'i1', state: 'COMPLETE', label: `resp${n}` })];

    // Latest (seq 3) resolves first and writes the cache…
    await act(async () => resolvers[2](resp(3)));
    expect(cached()[0].label).toBe('resp3');

    // …then the stale seq-1 response arrives late and must be ignored.
    await act(async () => resolvers[0](resp(1)));
    expect(cached()[0].label).toBe('resp3');
  });

  it('applies the server array when the toggle is the latest in flight', async () => {
    vi.mocked(apiPatch).mockResolvedValue([item({ id: 'i1', state: 'COMPLETE', label: 'server' })]);
    const { result, cached } = setup([item({ id: 'i1', state: 'PENDING' })]);

    act(() => result.current.toggleItem('i1', 'COMPLETE'));

    await waitFor(() => expect(cached()[0].label).toBe('server'));
  });
});
