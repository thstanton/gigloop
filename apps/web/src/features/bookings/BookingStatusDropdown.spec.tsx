import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingStatusDropdown from './BookingStatusDropdown';

// series-invoice-edit.spec.ts's "un-cancelling re-adds it" e2e case is flaky in exactly this
// window: the parent's `currentStatus` prop only catches up once the invalidated booking query
// refetches, which is slower than this dropdown's own optimistic `displayStatus`. If the user
// reopens the dropdown and re-selects the pre-change status before that refetch lands,
// `currentStatus` is still stale — `handleSelect`'s `s === currentStatus` guard reads that stale
// prop and treats a real revert as a no-op, silently swallowing the click.
describe('BookingStatusDropdown', () => {
  it('fires onStatusChange for a revert selected before the parent prop catches up', async () => {
    const onStatusChange = vi.fn();
    const { rerender } = render(
      <BookingStatusDropdown
        currentStatus="CONFIRMED"
        checklist={[]}
        onStatusChange={onStatusChange}
        isPending={false}
      />,
    );

    await userEvent.click(screen.getByText('Confirmed'));
    await userEvent.click(within(document.body).getByText('Cancelled'));
    expect(onStatusChange).toHaveBeenNthCalledWith(1, 'CANCELLED');

    // Simulate the real timing: the mutation's onSuccess only *invalidates* the booking query
    // (useBookingFields.ts), so `currentStatus` does not update synchronously with the click above
    // — the parent re-renders with the same stale prop while the refetch is still in flight.
    rerender(
      <BookingStatusDropdown
        currentStatus="CONFIRMED"
        checklist={[]}
        onStatusChange={onStatusChange}
        isPending={false}
      />,
    );

    await userEvent.click(screen.getByText('Cancelled'));
    await userEvent.click(within(document.body).getByText('Confirmed'));

    expect(onStatusChange).toHaveBeenNthCalledWith(2, 'CONFIRMED');
    expect(onStatusChange).toHaveBeenCalledTimes(2);
  });
});
