import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CopyEventDialog } from './CopyEventDialog';

const meta = {
  component: CopyEventDialog,
  tags: ['ai-generated'],
  args: {
    open: true,
    onOpenChange: fn(),
    onCopy: fn(),
    isPending: false,
    error: null,
  },
} satisfies Meta<typeof CopyEventDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    // The dialog telegraphs what carries vs. resets (implicit acceptance — ADR-0049).
    await expect(await body.findByText('Copy this event')).toBeVisible();
    await expect(body.getByText(/Carries over:/)).toBeVisible();
    await expect(body.getByText(/Starts fresh:/)).toBeVisible();
    // Copy is disabled until a date is chosen.
    await expect(body.getByRole('button', { name: 'Copy event' })).toBeDisabled();
  },
};

export const PrimaryPath: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Open the date picker and pick the first available day in the current month.
    await userEvent.click(body.getByText('Pick a date'));
    const dayButtons = (await body.findAllByRole('button')).filter((b) =>
      /^\d{1,2} \w+ \d{4}$/.test(b.getAttribute('aria-label') ?? ''),
    );
    await userEvent.click(dayButtons[0]);

    // With a date chosen, Copy enables and reports the YYYY-MM-DD date to the container.
    const copy = body.getByRole('button', { name: 'Copy event' });
    await expect(copy).toBeEnabled();
    await userEvent.click(copy);
    await expect(args.onCopy).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  },
};

export const Saving: Story = {
  args: { isPending: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('button', { name: 'Copying…' })).toBeDisabled();
  },
};

export const WithError: Story = {
  args: { error: 'Could not copy this event. Try again.' },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Could not copy this event. Try again.')).toBeVisible();
  },
};
