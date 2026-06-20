import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { VenueAtom } from './VenueAtom';

// A full Contact shape so the picker can resolve the seeded venue.
const venueContact = {
  id: 'v1',
  userId: 'user_storybook_test',
  name: 'The Grand Hotel',
  greetingName: null,
  email: null,
  phone: null,
  website: null,
  addressLine1: '123 Main Street',
  addressLine2: null,
  city: 'London',
  county: null,
  postcode: 'SW1A 1AA',
  country: 'GB',
  latitude: null,
  longitude: null,
  placeId: null,
  travelTimeMinutes: null,
  travelDistanceMetres: null,
  travelTimeCalculatedAt: null,
  travelMode: null,
  notes: null,
  parkingInfo: null,
  accessInfo: null,
  equipmentAvailable: null,
  commissionArrangement: null,
  primaryRole: 'VENUE',
  createdAt: '2030-06-01T00:00:00Z',
  updatedAt: '2030-06-01T00:00:00Z',
};

const meta = {
  component: VenueAtom,
  tags: ['ai-generated'],
  args: {
    initialVenueId: null,
    onSave: fn(),
    isSaving: false,
    saved: false,
    saveError: null,
  },
  parameters: {
    msw: {
      handlers: [http.get('/api/contacts', () => HttpResponse.json([venueContact]))],
    },
  },
} satisfies Meta<typeof VenueAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExistingTabDefault: Story = {
  name: 'Existing tab is default; Save disabled until a change is made',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // "Select existing" is the default tab — the picker combobox is visible.
    await expect(canvas.getByRole('combobox')).toBeVisible();
    // The "+ New" inline-create tab is present.
    await expect(canvas.getByRole('tab', { name: /\+ new/i })).toBeVisible();
    // Nothing has changed from the (empty) initial venue, so Save is disabled.
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeDisabled();
  },
};

export const CreateAndSave: Story = {
  name: 'Inline-create path: name a new venue and save',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /\+ new/i }));

    // In Storybook, Google Maps is unavailable → VenuePlaceSearch (searchOnly) renders a plain
    // name input. Typing a name makes the change saveable.
    const nameInput = await canvas.findByPlaceholderText('e.g. The O2 Arena');
    await userEvent.type(nameInput, 'Jazz Club');

    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    // The atom owns no mutation — it hands the host the user's intent.
    await expect(args.onSave).toHaveBeenCalledWith({
      kind: 'new',
      venue: expect.objectContaining({ name: 'Jazz Club' }),
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
  args: { saveError: 'Failed to save venue. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/failed to save venue/i)).toBeVisible();
  },
};
