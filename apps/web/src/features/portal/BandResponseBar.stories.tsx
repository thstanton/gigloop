import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { BandResponseBar } from './BandResponseBar';

const meta = {
  title: 'Portal/BandResponseBar',
  component: BandResponseBar,
  tags: ['ai-generated'],
  args: {
    status: 'INVITED',
    onConfirm: fn(),
    onDecline: fn(),
    pendingResponse: null,
  },
} satisfies Meta<typeof BandResponseBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Primary happy path (ADR-0024): an unanswered dep confirms.
export const Unanswered: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('Are you in for this gig?')).toBeVisible();
    const confirm = canvas.getByRole('button', { name: 'Confirm' });
    const decline = canvas.getByRole('button', { name: 'Decline' });
    await expect(confirm).toBeEnabled();
    await expect(decline).toBeEnabled();

    await userEvent.click(confirm);
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(args.onDecline).not.toHaveBeenCalled();
  },
};

export const Confirming: Story = {
  args: { pendingResponse: 'CONFIRMED' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Confirming…' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Decline' })).toBeDisabled();
  },
};

export const Confirmed: Story = {
  args: { status: 'CONFIRMED' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("You've confirmed you're playing this gig.")).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  },
};

export const Declined: Story = {
  args: { status: 'DECLINED' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("You've declined this gig.")).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  },
};
