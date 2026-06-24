import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { BookingConceptCard } from './BookingConceptCard';

/**
 * Wrapper that simulates the container's persisted dismissal: onDismiss flips
 * `isDismissed` to true (as useDismissibleHint would), letting one play exercise
 * the full visible → dismiss → recall cycle without a data hook.
 */
function StatefulConceptCard() {
  const [dismissed, setDismissed] = useState(false);
  return <BookingConceptCard isDismissed={dismissed} onDismiss={() => setDismissed(true)} />;
}

const meta = {
  title: 'Bookings/BookingConceptCard',
  component: BookingConceptCard,
  tags: ['autodocs'],
} satisfies Meta<typeof BookingConceptCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default visible card teaching the booking-as-project model. */
export const Visible: Story = {
  args: { isDismissed: false, onDismiss: () => {} },
};

/** Dismissed: collapses to a "How this works" recall trigger. */
export const Dismissed: Story = {
  args: { isDismissed: true, onDismiss: () => {} },
};

/** Full cycle: card visible → dismiss hides it → recall re-shows it. */
export const DismissAndRecall: Story = {
  args: { isDismissed: false, onDismiss: () => {} },
  render: () => <StatefulConceptCard />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: /how this booking works/i })).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: /dismiss/i }));
    await expect(canvas.queryByRole('heading', { name: /how this booking works/i })).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: /how this works/i }));
    await expect(canvas.getByRole('heading', { name: /how this booking works/i })).toBeVisible();
  },
};
