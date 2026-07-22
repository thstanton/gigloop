import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { VenueAtom } from './VenueAtom';
import type { Contact } from '@/types/api';

// A full Contact shape so the picker can resolve the seeded venue and the card can prefill.
const venueContact: Contact = {
  id: 'v1', name: 'The Grand Hotel', greetingName: null,
  email: null, phone: null, website: null,
  addressLine1: '123 Main Street', addressLine2: null, city: 'London', county: null,
  postcode: 'SW1A 1AA', country: 'GB', latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null,
  notes: null, parkingInfo: null, accessInfo: null, equipmentAvailable: null,
  commissionArrangement: null, primaryRole: 'VENUE',
  createdAt: '2030-06-01T00:00:00Z', updatedAt: '2030-06-01T00:00:00Z',
};

const meta = {
  component: VenueAtom,
  tags: ['ai-generated'],
  args: { venue: null, onSave: fn(), isSaving: false, saved: false, saveError: null },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([venueContact])),
        http.patch('/api/contacts/:id', async ({ request }) =>
          HttpResponse.json({ ...venueContact, ...(await request.json() as object) })),
      ],
    },
  },
} satisfies Meta<typeof VenueAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unassigned: Story = {
  name: 'No venue — assign-mode picker, Save disabled until a change',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('combobox')).toBeVisible();
    await expect(canvas.getByRole('tab', { name: /\+ new/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeDisabled();
  },
};

export const Assigned: Story = {
  name: 'Venue assigned — editable card with address visible',
  args: { venue: venueContact },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Venue')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /save contact/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /change venue/i })).toBeVisible();
    // Venue carve-out: the venue search is visible without opening the disclosure.
    await expect(canvas.getByText('Find venue')).toBeVisible();
  },
};

export const ChangeVenue: Story = {
  name: 'Change venue → assign-mode picker (removal is clear + Save here)',
  args: { venue: venueContact },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /change venue/i }));
    await expect(canvas.getByRole('combobox')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /^cancel$/i })).toBeVisible();
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

    // The atom hands the host the user's intent; the host owns the booking mutation.
    await expect(args.onSave).toHaveBeenCalledWith({
      kind: 'new',
      venue: expect.objectContaining({ name: 'Jazz Club' }),
    });
  },
};

export const SavingState: Story = {
  name: 'Assignment pending disables the Save and relabels to “Saving…”',
  args: { isSaving: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', { name: /saving…/i });
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();
  },
};

export const ErrorState: Story = {
  name: 'Assignment failure shows an inline error below the action',
  args: { saveError: 'Failed to save. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/failed to save/i)).toBeVisible();
  },
};
