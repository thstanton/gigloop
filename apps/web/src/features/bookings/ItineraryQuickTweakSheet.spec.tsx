import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ItineraryQuickTweakSheet } from './ItineraryQuickTweakSheet';
import { apiPatch } from '@/lib/api';
import type { BookingDetail } from '@/types/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue([]), // /packages template list
  apiPatch: vi.fn().mockResolvedValue({}),
  apiPost: vi.fn().mockResolvedValue({}),
  apiDelete: vi.fn().mockResolvedValue({}),
  apiPut: vi.fn().mockResolvedValue({}),
}));

function renderSheet(currentLogistics: BookingDetail['logistics']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ItineraryQuickTweakSheet
        bookingId="b1"
        eventType="WEDDING"
        sets={[]}
        packages={[]}
        currentLogistics={currentLogistics}
        open
        onOpenChange={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe('ItineraryQuickTweakSheet', () => {
  beforeEach(() => vi.clearAllMocks());

  // The inverse of the Details merge: logistics is one JSON column the API overwrites wholesale, and
  // the Itinerary owns only the three time anchors. Saving the anchors must merge over — never wipe —
  // the non-temporal Details keys and the user's custom fields.
  it('preserves the non-temporal Details + custom keys when saving the time anchors', async () => {
    renderSheet({
      dressCode: { value: 'Formal', shareWithBand: false, shareWithClient: false },
      customField1: { value: 'Backstage code', label: 'Access', shareWithBand: false, shareWithClient: false },
    });

    await userEvent.type(screen.getByLabelText('Arrival time'), '17:30');
    await userEvent.click(screen.getByRole('button', { name: /save times/i }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1));
    expect(apiPatch).toHaveBeenCalledWith('/bookings/b1', {
      logistics: {
        // The non-temporal Details keys survive untouched…
        dressCode: { value: 'Formal', shareWithBand: false, shareWithClient: false },
        // …the user's custom field is preserved, not dropped…
        customField1: { value: 'Backstage code', label: 'Access', shareWithBand: false, shareWithClient: false },
        // …and the newly-entered anchor is overlaid.
        arrivalTime: { value: '17:30', shareWithBand: false, shareWithClient: false },
      },
    });
  });
});
