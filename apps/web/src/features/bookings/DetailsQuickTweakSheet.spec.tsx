import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DetailsQuickTweakSheet } from './DetailsQuickTweakSheet';
import { apiPatch } from '@/lib/api';
import type { BookingDetail } from '@/types/api';

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true }),
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue({ preferences: { customDressCodeOptions: [] } }),
  apiPatch: vi.fn().mockResolvedValue({}),
}));

function renderSheet(currentLogistics: BookingDetail['logistics']) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DetailsQuickTweakSheet
        bookingId="b1"
        currentLogistics={currentLogistics}
        open
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe('DetailsQuickTweakSheet', () => {
  beforeEach(() => vi.clearAllMocks());

  // The seam that matters: logistics is one JSON column the API overwrites wholesale, shared with
  // the Itinerary atom's time anchors. A Details save must merge over — never wipe — the time keys.
  it('preserves the Itinerary time anchors when saving a non-temporal change', async () => {
    renderSheet({
      arrivalTime: { value: '18:00', shareWithBand: false, shareWithClient: false },
      soundCheckTime: { value: '17:00', shareWithBand: false, shareWithClient: false },
      dressCode: { value: 'Formal', shareWithBand: false, shareWithClient: false },
      // A genuine user custom field: must be kept (the other half of the key partitioning —
      // it must NOT be mistaken for a system key and dropped).
      customField1: { value: 'Backstage code', label: 'Access', shareWithBand: false, shareWithClient: false },
    });

    await userEvent.type(screen.getByLabelText('Performance space'), 'Main hall');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1));
    expect(apiPatch).toHaveBeenCalledWith('/bookings/b1', {
      logistics: {
        // Time anchors survive untouched…
        arrivalTime: { value: '18:00', shareWithBand: false, shareWithClient: false },
        soundCheckTime: { value: '17:00', shareWithBand: false, shareWithClient: false },
        // …alongside the existing and newly-edited non-temporal fields…
        dressCode: { value: 'Formal', shareWithBand: false, shareWithClient: false },
        performanceSpace: { value: 'Main hall', shareWithBand: false, shareWithClient: false },
        // …and the user's custom field is preserved, not dropped.
        customField1: { value: 'Backstage code', label: 'Access', shareWithBand: false, shareWithClient: false },
      },
    });
  });

  // Consistent quick-tweak behaviour: a successful save closes the sheet (the updated card is the
  // feedback) rather than showing an inline "Saved".
  it('closes the sheet on a successful save', async () => {
    const { onOpenChange } = renderSheet({
      dressCode: { value: 'Formal', shareWithBand: false, shareWithClient: false },
    });

    await userEvent.type(screen.getByLabelText('Performance space'), 'Main hall');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
