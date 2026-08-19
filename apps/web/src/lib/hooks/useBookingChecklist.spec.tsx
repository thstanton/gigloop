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

// Versions are ISO-8601 UTC, as the API emits them. V0 is what the cache starts at.
const V0 = '2025-01-01T00:00:00.000Z';
const V1 = '2025-01-01T00:00:01.000Z';
const V2 = '2025-01-01T00:00:02.000Z';
const V3 = '2025-01-01T00:00:03.000Z';

// A toggle's response is the WHOLE recomputed checklist, read after a full re-evaluation that is
// not in the same transaction as the write (bookings.service.ts). So a response can legitimately
// carry a stale copy of a goal another in-flight toggle has already moved. ADR-0076: settle by the
// server's per-goal `updatedAt`, newest wins, ties keep what is on screen.
describe('useBookingChecklist — toggle responses settle by server version (ADR-0076)', () => {
  beforeEach(() => vi.clearAllMocks());

  function deferred() {
    const resolvers: Array<(v: ChecklistItem[]) => void> = [];
    vi.mocked(apiPatch).mockImplementation(
      () => new Promise<ChecklistItem[]>((resolve) => resolvers.push(resolve)),
    );
    return resolvers;
  }

  it('keeps both ticks when two different goals are toggled concurrently (#595)', async () => {
    // THE regression. Under the old client-side toggle-sequence guard this failed: i2's response
    // (the latest-initiated) wrote its stale copy of i1 wholesale, and i1's own response — the one
    // carrying the correction — was then discarded for not being the latest. i1 visibly un-ticked.
    const resolvers = deferred();
    const { result, cached } = setup([
      item({ id: 'i1', state: 'PENDING', updatedAt: V0 }),
      item({ id: 'i2', state: 'PENDING', updatedAt: V0 }),
    ]);

    act(() => {
      result.current.toggleItem('i1', 'COMPLETE');
      result.current.toggleItem('i2', 'COMPLETE');
    });
    await waitFor(() => expect(resolvers).toHaveLength(2));

    const byId = () => Object.fromEntries(cached().map((i) => [i.id, i]));

    // i2's response read the checklist BEFORE i1's write landed, so it carries i1 as still PENDING
    // at its original version. It resolves first.
    await act(async () =>
      resolvers[1]([
        item({ id: 'i1', state: 'PENDING', updatedAt: V0 }),
        item({ id: 'i2', state: 'COMPLETE', updatedAt: V2 }),
      ]),
    );
    // i1 ties (the optimistic tick does not bump the version) so the tick survives; i2 is newer.
    expect(byId().i1.state).toBe('COMPLETE');
    expect(byId().i2.state).toBe('COMPLETE');

    // i1's own response arrives late carrying its settled version — and a stale i2.
    await act(async () =>
      resolvers[0]([
        item({ id: 'i1', state: 'COMPLETE', updatedAt: V1 }),
        item({ id: 'i2', state: 'PENDING', updatedAt: V0 }),
      ]),
    );
    expect(byId().i1.state).toBe('COMPLETE');
    expect(byId().i2.state).toBe('COMPLETE');
  });

  it('lets a non-latest response settle the goals it is genuinely newer for', async () => {
    // What the old guard prevented: an earlier toggle response was thrown away entirely, so its
    // goal never received its server-settled form. Now it contributes exactly what it knows.
    const resolvers = deferred();
    const { result, cached } = setup([
      item({ id: 'i1', state: 'PENDING', updatedAt: V0, label: 'stale' }),
      item({ id: 'i2', state: 'PENDING', updatedAt: V0 }),
    ]);

    act(() => {
      result.current.toggleItem('i1', 'COMPLETE');
      result.current.toggleItem('i2', 'COMPLETE');
    });
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () =>
      resolvers[1]([
        item({ id: 'i1', state: 'PENDING', updatedAt: V0, label: 'stale' }),
        item({ id: 'i2', state: 'COMPLETE', updatedAt: V2 }),
      ]),
    );
    await act(async () =>
      resolvers[0]([
        item({ id: 'i1', state: 'COMPLETE', updatedAt: V1, label: 'settled' }),
        item({ id: 'i2', state: 'PENDING', updatedAt: V0 }),
      ]),
    );

    expect(cached().find((i) => i.id === 'i1')!.label).toBe('settled');
  });

  it('ignores a slow earlier response for the same goal (the #587 case, now server-ordered)', async () => {
    const resolvers = deferred();
    const { result, cached } = setup([item({ id: 'i1', state: 'PENDING', updatedAt: V0 })]);

    act(() => {
      result.current.toggleItem('i1', 'COMPLETE');
      result.current.toggleItem('i1', 'PENDING');
      result.current.toggleItem('i1', 'COMPLETE');
    });
    await waitFor(() => expect(resolvers).toHaveLength(3));

    await act(async () =>
      resolvers[2]([item({ id: 'i1', state: 'COMPLETE', updatedAt: V3, label: 'resp3' })]),
    );
    expect(cached()[0].label).toBe('resp3');

    // The first toggle's response arrives late at an older version and loses on merit.
    await act(async () =>
      resolvers[0]([item({ id: 'i1', state: 'COMPLETE', updatedAt: V1, label: 'resp1' })]),
    );
    expect(cached()[0].label).toBe('resp3');
  });

  it('keeps the optimistic tick when a response ties on version', async () => {
    // The tie is reached on every tap: onMutate flips state client-side without bumping
    // `updatedAt`, so an in-flight goal carries a new state at its old version. Resolving the
    // tie towards the incoming copy would revert the tap — which is the bug being fixed.
    const resolvers = deferred();
    const { result, cached } = setup([item({ id: 'i1', state: 'PENDING', updatedAt: V0 })]);

    act(() => result.current.toggleItem('i1', 'COMPLETE'));
    await waitFor(() => expect(resolvers).toHaveLength(1));

    await act(async () => resolvers[0]([item({ id: 'i1', state: 'PENDING', updatedAt: V0 })]));

    expect(cached()[0].state).toBe('COMPLETE');
  });

  it('takes membership from the server response, never resurrecting a dropped goal', async () => {
    vi.mocked(apiPatch).mockResolvedValue([item({ id: 'i1', state: 'COMPLETE', updatedAt: V1 })]);
    const { result, cached } = setup([
      item({ id: 'i1', state: 'PENDING', updatedAt: V0 }),
      item({ id: 'i2', state: 'PENDING', updatedAt: V0 }),
    ]);

    act(() => result.current.toggleItem('i1', 'COMPLETE'));

    await waitFor(() => expect(cached()).toHaveLength(1));
    expect(cached()[0].id).toBe('i1');
  });

  it('applies the server array to a cache that has no prior copy', async () => {
    vi.mocked(apiPatch).mockResolvedValue([
      item({ id: 'i1', state: 'COMPLETE', updatedAt: V1, label: 'server' }),
    ]);
    const { result, cached } = setup([item({ id: 'i1', state: 'PENDING', updatedAt: V0 })]);

    act(() => result.current.toggleItem('i1', 'COMPLETE'));

    await waitFor(() => expect(cached()[0].label).toBe('server'));
  });
});
