import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { MusicAtom } from './MusicAtom';
import type { MusicFormConfig } from '@/types/api';

const emptyConfig: MusicFormConfig = {
  id: 'mfc1',
  bookingId: 'b1',
  keyMoments: [],
  enabledGenres: ['CONTEMPORARY', 'CLASSICAL', 'JAZZ', 'FILM_TV_MUSICALS'],
  publishedAt: null, // #533: turned-on but not yet published → draft
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

const configuredConfig: MusicFormConfig = {
  ...emptyConfig,
  keyMoments: [
    { label: 'Walking down the aisle', section: 'Ceremony' },
    { label: 'First dance', section: 'Reception' },
    { label: 'Last song', section: 'Other' },
  ],
};

const publishedConfig: MusicFormConfig = {
  ...emptyConfig,
  publishedAt: '2026-06-02T00:00:00Z',
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
    isPublished: false,
    onPublish: fn(),
    onUnpublish: fn(),
    isPublishing: false,
    isUnpublishing: false,
    isSaving: false,
    saved: false,
    saveError: null,
    isTurningOn: false,
    isTurningOff: false,
  },
} satisfies Meta<typeof MusicAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnEmptyGrouped: Story = {
  name: 'On, empty: grouped special-request editor (a group per package + Other)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('switch', { name: /music form/i })).toBeChecked();
    // Genres seeded from the turn-on defaults.
    await expect(canvas.getByRole('button', { name: /^contemporary$/i })).toBeEnabled();
    // One "Add request" control per group.
    await expect(canvas.getAllByRole('button', { name: /add request/i })).toHaveLength(3);
  },
};

export const OnConfigured: Story = {
  name: 'On, configured: special requests grouped under their packages',
  args: { config: configuredConfig },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByDisplayValue('Walking down the aisle')).toBeVisible();
    await expect(canvas.getByDisplayValue('First dance')).toBeVisible();
  },
};

export const HappyPath: Story = {
  name: 'Happy path: add a special request, enable a genre, then save',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Add a request in the first group.
    await userEvent.click(canvas.getAllByRole('button', { name: /add request/i })[0]);
    const input = canvas.getByRole('textbox', { name: /special request/i });
    await userEvent.type(input, 'First dance');

    // Toggle a genre off (Contemporary is seeded on) to register a change either way.
    await userEvent.click(canvas.getByRole('button', { name: /^jazz$/i }));

    const save = canvas.getByRole('button', { name: /^save draft$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        keyMoments: [expect.objectContaining({ label: 'First dance' })],
      }),
    );
  },
};

export const SaveDisabledUntilChange: Story = {
  name: 'Save draft is disabled when nothing has changed — but Publish stays enabled',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /^save draft$/i })).toBeDisabled();
    // #533 story 20: publishing unchanged defaults is allowed, so Publish is never gated on edits.
    await expect(canvas.getByRole('button', { name: /^publish$/i })).toBeEnabled();
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

export const DraftShowsSaveDraftAndPublish: Story = {
  name: '#533 draft: shows Save draft + Publish; Publish carries the current edits',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /^save draft$/i })).toBeVisible();
    // A draft has no un-publish action.
    await expect(canvas.queryByRole('button', { name: /un-publish/i })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /^publish$/i }));
    await expect(args.onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ enabledGenres: expect.arrayContaining(['CONTEMPORARY']) }),
    );
  },
};

export const PublishedShowsSaveAndUnpublish: Story = {
  name: '#533 published: shows Save + Un-publish (no Publish/Save draft)',
  args: { config: publishedConfig, isPublished: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /^publish$/i })).toBeNull();
    await expect(canvas.queryByRole('button', { name: /save draft/i })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /un-publish/i }));
    await expect(args.onUnpublish).toHaveBeenCalled();
  },
};

export const Off: Story = {
  name: 'Off: Switch is off and the editor is a dimmed, inert defaults preview',
  args: { hasMusicFormConfig: false, config: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('switch', { name: /music form/i })).not.toBeChecked();
    // The default genres are previewed but inert; there is no Save action when off.
    await expect(canvas.getByRole('button', { name: /^contemporary$/i })).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: /^save$/i })).toBeNull();
  },
};

export const TurnOnFromSwitch: Story = {
  name: 'Off → flipping the Switch on fires onTurnOn',
  args: { hasMusicFormConfig: false, config: null },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('switch', { name: /music form/i }));
    await expect(args.onTurnOn).toHaveBeenCalled();
  },
};

export const WarnBeforeTurnOff: Story = {
  name: 'Turn-off with requests: confirm appears first; cancel leaves it on',
  args: { config: configuredConfig },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Flipping the Switch off when special requests exist shows a confirm, not an immediate delete.
    await userEvent.click(canvas.getByRole('switch', { name: /music form/i }));
    await expect(canvas.getByRole('button', { name: /yes, turn off/i })).toBeVisible();
    await expect(args.onTurnOff).not.toHaveBeenCalled();

    // Cancel restores the editor and never deletes.
    await userEvent.click(canvas.getByRole('button', { name: /^cancel$/i }));
    await expect(canvas.queryByRole('button', { name: /yes, turn off/i })).toBeNull();
    await expect(args.onTurnOff).not.toHaveBeenCalled();
  },
};

export const TurnOffSilentlyWhenEmpty: Story = {
  name: 'Turn-off with no requests: deletes silently (no confirm)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // emptyConfig has genres but no special requests → turning off fires onTurnOff immediately.
    await userEvent.click(canvas.getByRole('switch', { name: /music form/i }));
    await expect(args.onTurnOff).toHaveBeenCalled();
    await expect(canvas.queryByRole('button', { name: /yes, turn off/i })).toBeNull();
  },
};
