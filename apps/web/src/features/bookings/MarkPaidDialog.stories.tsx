import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { MarkPaidDialog } from './MarkPaidDialog';

const meta = {
  component: MarkPaidDialog,
  tags: ['ai-generated'],
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
    isPending: false,
    invoiceLabel: 'Deposit invoice',
  },
} satisfies Meta<typeof MarkPaidDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Default: the date defaults to today, so Record payment is enabled immediately and the
// reference is genuinely optional (nothing typed).
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Record payment', { selector: 'h2, [role="heading"]' })).toBeVisible();
    // Prefilled to today ⇒ the confirm button is enabled with no interaction.
    await expect(body.getByRole('button', { name: 'Record payment' })).toBeEnabled();
    await expect(body.getByText(/Optional — e.g. a bank reference/)).toBeVisible();
  },
};

// Primary happy path (ADR-0024): today's prefilled date + a typed reference are reported to
// the container as (YYYY-MM-DD, reference).
export const PrimaryPath: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.type(body.getByPlaceholderText('Optional'), 'BACS-4417');

    const confirm = body.getByRole('button', { name: 'Record payment' });
    await expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await expect(args.onConfirm).toHaveBeenCalledWith(expect.stringMatching(YMD), 'BACS-4417');
  },
};

// Backdated: picking an earlier day reports that chosen date, not today — the whole point of
// the dialog (AC: a backdated payment stores the chosen date).
export const Backdated: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByText(/^\d/)); // the date-picker trigger shows a formatted date
    const dayButtons = (await body.findAllByRole('button')).filter((b) =>
      /^\d{1,2} \w+ \d{4}$/.test(b.getAttribute('aria-label') ?? ''),
    );
    await userEvent.click(dayButtons[0]); // first day of the shown month

    await userEvent.click(body.getByRole('button', { name: 'Record payment' }));
    await expect(args.onConfirm).toHaveBeenCalledWith(expect.stringMatching(YMD), '');
  },
};

// Reference blank: confirming without touching the reference succeeds and reports an empty string.
export const ReferenceBlank: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole('button', { name: 'Record payment' }));
    await expect(args.onConfirm).toHaveBeenCalledWith(expect.stringMatching(YMD), '');
  },
};

// Pending: the confirm button reflects the in-flight mutation and is disabled.
export const Pending: Story = {
  args: { isPending: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('button', { name: 'Recording…' })).toBeDisabled();
  },
};
