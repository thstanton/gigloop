import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PerformanceEditor from './PerformanceEditor';
import type { BookingDetail, PerformanceSet } from '@/types/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPost: vi.fn().mockResolvedValue({}),
  apiPatch: vi.fn().mockResolvedValue(undefined),
  apiDelete: vi.fn().mockResolvedValue(undefined),
}));

const toastMock = vi.fn();
vi.mock('@/lib/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

function makeSet(overrides: Partial<PerformanceSet> = {}): PerformanceSet {
  return {
    id: 'set-1',
    order: 1,
    duration: 30,
    startTime: null,
    label: 'Set 1',
    packageId: 'pkg-1',
    ...overrides,
  };
}

function makeBooking(set: PerformanceSet): BookingDetail {
  return {
    id: 'b1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'CONFIRMED',
    eventType: 'WEDDING',
    date: '2026-08-15T18:00:00Z',
    title: null,
    fee: null,
    notes: null,
    customerId: 'c1',
    // The editor only reads a handful of customer fields indirectly; a stub is enough.
    customer: null as unknown as BookingDetail['customer'],
    venueId: null,
    venue: null,
    bookingAgentId: null,
    bookingAgent: null,
    sets: [set],
    series: null,
    seriesId: null,
    packages: [
      {
        id: 'pkg-1',
        order: 1,
        label: 'Acoustic Set',
        icon: 'music',
      },
    ],
    depositReceivedAt: null,
    portalToken: 'tok-1',
    hasMusicFormConfig: false,
    hasMusicFormResponse: false,
    logistics: null,
    activeContract: null,
  };
}

function tree(booking: BookingDetail, client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <PerformanceEditor booking={booking} isOpen />
      <button type="button">outside the row</button>
    </QueryClientProvider>
  );
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe('PerformanceEditor — SetEditRow blur-out save (#479)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT save while tabbing between fields within the same row', async () => {
    const user = userEvent.setup();
    const { apiPatch } = await import('@/lib/api');

    render(tree(makeBooking(makeSet()), makeClient()));

    const label = screen.getByLabelText('Set label');
    await user.clear(label);
    await user.type(label, 'New label');
    // Tab to the next field *inside the row* (duration) — focus stays in the row.
    await user.tab();
    expect(screen.getByLabelText('Duration in minutes')).toHaveFocus();

    expect(apiPatch).not.toHaveBeenCalled();
  });

  it('saves exactly once when focus leaves the whole row', async () => {
    const user = userEvent.setup();
    const { apiPatch } = await import('@/lib/api');

    render(tree(makeBooking(makeSet()), makeClient()));

    const label = screen.getByLabelText('Set label');
    await user.clear(label);
    await user.type(label, 'New label');
    await user.click(screen.getByRole('button', { name: 'outside the row' }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1));
    expect(apiPatch).toHaveBeenCalledWith('/bookings/b1/sets/set-1', {
      label: 'New label',
      duration: 30,
      startTime: null,
    });
  });

  it('does NOT disable the fields while a save is in flight', async () => {
    const user = userEvent.setup();
    const { apiPatch } = await import('@/lib/api');
    // Keep the save pending so we can inspect the row mid-flight.
    vi.mocked(apiPatch).mockReturnValue(new Promise(() => {}));

    render(tree(makeBooking(makeSet()), makeClient()));

    const label = screen.getByLabelText('Set label');
    await user.clear(label);
    await user.type(label, 'New label');
    await user.click(screen.getByRole('button', { name: 'outside the row' }));

    expect(await screen.findByText('Saving…')).toBeInTheDocument();
    expect(screen.getByLabelText('Set label')).not.toBeDisabled();
    expect(screen.getByLabelText('Duration in minutes')).not.toBeDisabled();
    expect(screen.getByLabelText('Start time')).not.toBeDisabled();
  });

  it('does not clobber in-progress edits when fresh server data arrives mid-edit', async () => {
    const user = userEvent.setup();
    const client = makeClient();

    const { rerender } = render(tree(makeBooking(makeSet({ label: 'Set 1' })), client));

    const label = screen.getByLabelText('Set label');
    await user.clear(label);
    await user.type(label, 'Edited');

    // A query invalidation lands while the row is still focused (simulating a
    // refetch resolving). The sync-from-props effect must NOT overwrite the edit.
    rerender(tree(makeBooking(makeSet({ label: 'Stale server value' })), client));

    expect(screen.getByLabelText('Set label')).toHaveValue('Edited');
  });

  it('syncs from fresh server data when the row is not being edited', async () => {
    const client = makeClient();
    const { rerender } = render(tree(makeBooking(makeSet({ label: 'Set 1' })), client));

    expect(screen.getByLabelText('Set label')).toHaveValue('Set 1');

    rerender(tree(makeBooking(makeSet({ label: 'Renamed elsewhere' })), client));

    expect(screen.getByLabelText('Set label')).toHaveValue('Renamed elsewhere');
  });
});
