import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OverviewQuickTweakSheet } from './OverviewQuickTweakSheet';
import { apiPatch } from '@/lib/api';

vi.mock('@clerk/react', () => ({ useAuth: () => ({ isLoaded: true }) }));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPatch: vi.fn().mockResolvedValue({}),
}));

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OverviewQuickTweakSheet
        bookingId="b1"
        initialEventType="WEDDING"
        initialDate="2026-08-15"
        initialFee="2500"
        initialTitle="Smith Wedding"
        initialSeriesId={null}
        open
        onOpenChange={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe('OverviewQuickTweakSheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PATCHes only the changed field', async () => {
    renderSheet();

    const title = screen.getByLabelText('Title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Smith Anniversary');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1));
    expect(apiPatch).toHaveBeenCalledWith('/bookings/b1', { title: 'Smith Anniversary' });
  });

  // Date is edited date-only and must round-trip as a YMD string (the event time-of-day lives in
  // the logistics anchors, not booking.date) — guards against a silent time-component shift.
  it('round-trips the date as a date-only YMD string', async () => {
    renderSheet();

    // The DatePicker trigger shows the formatted current date; open it and pick the 20th.
    await userEvent.click(screen.getByText('15 Aug 2026'));
    await userEvent.click(screen.getByRole('button', { name: '20 August 2026' }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1));
    expect(apiPatch).toHaveBeenCalledWith('/bookings/b1', { date: '2026-08-20' });
  });
});
