import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { PeopleAtom } from './PeopleAtom';

const meta = {
  component: PeopleAtom,
  tags: ['ai-generated'],
  args: {
    initialCustomerId: null,
    initialAgentId: null,
    onSave: fn(),
    isSaving: false,
    saved: false,
    saveError: null,
  },
  parameters: {
    msw: {
      handlers: [http.get('/api/contacts', () => HttpResponse.json([]))],
    },
  },
} satisfies Meta<typeof PeopleAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Customer + agent fields render; Save disabled until a change is made',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Both roles default to their "Select existing" picker.
    await expect(canvas.getAllByRole('combobox')).toHaveLength(2);
    // Nothing changed yet → Save disabled.
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeDisabled();
  },
};

export const InlineCreateCustomerAndSave: Story = {
  name: 'Inline-create a customer and save (emits only the changed role)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // The customer field is the first; switch it to inline-create.
    const newTabs = canvas.getAllByRole('tab', { name: /\+ new/i });
    await userEvent.click(newTabs[0]);

    const nameInput = await canvas.findByPlaceholderText('e.g. Jane Smith');
    await userEvent.type(nameInput, 'Jane Smith');

    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    await expect(args.onSave).toHaveBeenCalledWith({
      customer: { kind: 'new', contact: expect.objectContaining({ name: 'Jane Smith' }) },
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
  args: { saveError: 'Failed to save people. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/failed to save people/i)).toBeVisible();
  },
};
