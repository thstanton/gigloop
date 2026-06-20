import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { MusicAtom } from './MusicAtom';
import type { MusicFormConfig } from '@/types/api';

const emptyConfig: MusicFormConfig = {
  id: 'mfc1',
  bookingId: 'b1',
  keyMoments: [],
  enabledGenres: [],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

const packages = [
  { id: 'pkg1', order: 1, label: 'Ceremony', icon: 'music' },
  { id: 'pkg2', order: 2, label: 'Reception', icon: 'party-popper' },
];

const meta = {
  component: MusicAtom,
  tags: ['ai-generated'],
  args: {
    hasMusicFormConfig: true,
    config: emptyConfig,
    packages,
    onSave: fn(),
    onTurnOn: fn(),
    onTurnOff: fn(),
    isSaving: false,
    saved: false,
    saveError: null,
    isTurningOn: false,
    isTurningOff: false,
  },
} satisfies Meta<typeof MusicAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddKeyMomentAndGenre: Story = {
  name: 'Happy path: add a key moment, select its section, enable a genre, then save',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Add a key moment row.
    await userEvent.click(canvas.getByRole('button', { name: /add key moment/i }));
    const labelInput = canvas.getByRole('textbox', { name: /key moment label/i });
    await userEvent.type(labelInput, 'First dance');

    // The section select defaults to "Other" — verify it's present.
    const sectionSelect = canvas.getByRole('combobox', { name: /key moment section/i });
    await expect(sectionSelect).toBeVisible();

    // Enable the Pop genre.
    await userEvent.click(canvas.getByRole('button', { name: /^pop$/i }));

    // Save is now enabled because the atom has unsaved changes.
    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        keyMoments: [expect.objectContaining({ label: 'First dance' })],
        enabledGenres: expect.arrayContaining(['pop']),
      }),
    );
  },
};

export const SaveDisabledUntilChange: Story = {
  name: 'Save is disabled when nothing has changed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeDisabled();
  },
};

export const SavingState: Story = {
  name: 'Tier-1: pending disables Save and relabels to "Saving…"',
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
  args: { saveError: 'Failed to save music form. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/failed to save music form/i)).toBeVisible();
  },
};

export const Off: Story = {
  name: 'Off: shows the turn-on button when hasMusicFormConfig is false',
  args: { hasMusicFormConfig: false, config: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /turn on music form/i })).toBeVisible();
    // The editor UI is not shown.
    await expect(canvas.queryByRole('button', { name: /^save$/i })).toBeNull();
  },
};

export const TurnOnPending: Story = {
  name: 'Off + turning on: button is disabled and relabels to "Turning on…"',
  args: { hasMusicFormConfig: false, config: null, isTurningOn: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByRole('button', { name: /turning on…/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  },
};

export const TurnOffConfirm: Story = {
  name: 'Turn-off: confirm dialog appears before deletion, then onTurnOff fires',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // "Remove music form" is visible initially.
    const removeBtn = canvas.getByRole('button', { name: /remove music form/i });
    await expect(removeBtn).toBeVisible();
    await userEvent.click(removeBtn);

    // Confirm dialog appears.
    const confirmBtn = canvas.getByRole('button', { name: /yes, remove/i });
    await expect(confirmBtn).toBeVisible();
    await expect(canvas.getByRole('button', { name: /^cancel$/i })).toBeVisible();

    await userEvent.click(confirmBtn);
    await expect(args.onTurnOff).toHaveBeenCalled();
  },
};

export const TurnOffCancel: Story = {
  name: 'Turn-off: cancelling the confirm dialog restores the Remove button',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /remove music form/i }));
    await userEvent.click(canvas.getByRole('button', { name: /^cancel$/i }));
    // Confirm dialog is gone; onTurnOff must NOT have been called.
    await expect(canvas.getByRole('button', { name: /remove music form/i })).toBeVisible();
    await expect(args.onTurnOff).not.toHaveBeenCalled();
  },
};
