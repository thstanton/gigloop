import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { OverviewAtom } from './OverviewAtom';

const meta = {
  component: OverviewAtom,
  tags: ['ai-generated'],
  args: {
    initialEventType: 'WEDDING',
    initialDate: '2026-08-15',
    initialFee: '2500',
    initialTitle: 'Smith Wedding',
    initialSeriesId: null,
    series: [
      { id: 's1', label: 'Summer Weddings 2026' },
      { id: 's2', label: 'Hotel Corporate Events' },
    ],
    onSave: fn(),
    isSaving: false,
    saved: false,
    saveError: null,
  },
} satisfies Meta<typeof OverviewAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Identity fields present; status is NOT editable here; Save disabled until a change',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Event type')).toBeVisible();
    await expect(canvas.getByLabelText('Fee')).toBeVisible();
    await expect(canvas.getByLabelText('Title')).toBeVisible();
    // Status transition stays a standalone action — it is not a field in the atom.
    await expect(canvas.queryByLabelText(/status/i)).toBeNull();
    // Nothing changed yet, so Save is disabled.
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeDisabled();
  },
};

export const EditTitleAndSave: Story = {
  name: 'Editing a field enables Save and surfaces only the changed field',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByLabelText('Title');
    await userEvent.clear(title);
    await userEvent.type(title, 'Smith Anniversary');

    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    // The atom owns no mutation — it hands the host only what changed.
    await expect(args.onSave).toHaveBeenCalledWith({ title: 'Smith Anniversary' });
  },
};

export const ClearFee: Story = {
  name: 'Clearing the fee surfaces fee: null',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(canvas.getByLabelText('Fee'));

    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);
    await expect(args.onSave).toHaveBeenCalledWith({ fee: null });
  },
};

export const SavingState: Story = {
  name: 'Tier-1: pending disables the button and relabels to "Saving…"',
  args: { isSaving: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', { name: /saving…/i });
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();
  },
};

export const SavedState: Story = {
  name: 'Tier-1: success shows an inline "Saved"',
  args: { saved: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Saved')).toBeVisible();
  },
};

export const ErrorState: Story = {
  name: 'Tier-1: failure shows an inline error below the action',
  args: { saveError: 'Failed to save. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/failed to save/i)).toBeVisible();
  },
};

// ─── Series assignment stories ────────────────────────────────────────────────

export const SeriesFieldsVisible: Story = {
  name: 'Series: toggle pills are visible; Save disabled until a selection differs from initial',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /^none$/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /existing series/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /new series/i })).toBeVisible();
    // No series change yet, so Save is disabled.
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeDisabled();
  },
};

export const SeriesNoneToNew: Story = {
  name: 'Series: none → new series → save surfaces { series: { mode: "new", label } }',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /new series/i }));
    const labelInput = canvas.getByLabelText('Series label');
    await userEvent.type(labelInput, 'Hotel Grand — 2026');

    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ series: { mode: 'new', label: 'Hotel Grand — 2026' } }),
    );
  },
};

export const SeriesNoneToExisting: Story = {
  name: 'Series: none → existing series → save surfaces { series: { mode: "existing", seriesId } }',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /existing series/i }));

    // Select from the dropdown. Radix Select renders its options in a portal on
    // document.body, outside canvasElement — query the body, not the canvas.
    const trigger = canvas.getByLabelText('Series');
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    const option = await body.findByText('Summer Weddings 2026');
    await userEvent.click(option);

    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ series: { mode: 'existing', seriesId: 's1' } }),
    );
  },
};

export const SeriesRemove: Story = {
  name: 'Series: booking already in a series → switch to None → save surfaces { series: { mode: "none" } }',
  args: { initialSeriesId: 's1' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // Booking starts in 'existing' mode (initialSeriesId is set); switching to 'None' is a change.
    await userEvent.click(canvas.getByRole('button', { name: /^none$/i }));

    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ series: { mode: 'none' } }),
    );
  },
};
