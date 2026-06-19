import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { DetailsAtom } from './DetailsAtom';

// The DressCodeField reads /me for the musician's custom dress-code options.
const userProfile = {
  id: 'user_storybook_test',
  email: 'test@example.com',
  preferences: { customDressCodeOptions: [] },
};

const meta = {
  component: DetailsAtom,
  tags: ['ai-generated'],
  args: {
    initialLogistics: null,
    onSave: fn(),
    isSaving: false,
    saved: false,
    saveError: null,
  },
  parameters: {
    msw: {
      handlers: [http.get('/api/me', () => HttpResponse.json(userProfile))],
    },
  },
} satisfies Meta<typeof DetailsAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Save disabled until a non-temporal field changes',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The conditions fields are present…
    await expect(canvas.getByLabelText('Performance space')).toBeVisible();
    await expect(canvas.getByLabelText('Dress code')).toBeVisible();
    // …but the time anchors are NOT — they belong to the Itinerary atom (#521).
    await expect(canvas.queryByLabelText(/arrival time/i)).toBeNull();
    await expect(canvas.queryByLabelText(/soundcheck time/i)).toBeNull();
    await expect(canvas.queryByLabelText(/finish time/i)).toBeNull();
    // Nothing has changed, so Save is disabled.
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeDisabled();
  },
};

export const EditAndSave: Story = {
  name: 'Editing a field enables Save and surfaces the detail-only payload',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const space = canvas.getByLabelText('Performance space');
    await userEvent.type(space, 'Main hall');

    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    // The atom owns no mutation — it hands the host the non-temporal slice only.
    await expect(args.onSave).toHaveBeenCalledWith({
      performanceSpace: { value: 'Main hall', shareWithBand: false, shareWithClient: false },
    });
  },
};

export const SavingState: Story = {
  name: 'Tier-1: pending disables the button and relabels to “Saving…”',
  args: { isSaving: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', { name: /saving…/i });
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();
  },
};

export const SavedState: Story = {
  name: 'Tier-1: success shows an inline “Saved”',
  args: { saved: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Saved')).toBeVisible();
  },
};

export const ErrorState: Story = {
  name: 'Tier-1: failure shows an inline error below the action',
  args: { saveError: 'Failed to save details. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/failed to save details/i)).toBeVisible();
  },
};
