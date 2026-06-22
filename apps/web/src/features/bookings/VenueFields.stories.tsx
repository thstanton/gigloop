import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { VenueFields } from './VenueFields';

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
  component: VenueFields,
  tags: ['ai-generated'],
  args: {
    initialVenueId: null,
    onChange: fn(),
  },
  parameters: {
    msw: {
      handlers: [http.get('/api/contacts', () => HttpResponse.json([venueContact]))],
    },
  },
} satisfies Meta<typeof VenueFields>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExistingDefault: Story = {
  name: 'Defaults to the "Select existing" picker',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('combobox')).toBeVisible();
    await expect(canvas.getByRole('tab', { name: /\+ new/i })).toBeVisible();
  },
};

export const PickExisting: Story = {
  name: 'Pick-existing: selecting a venue bubbles { kind: existing }',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    const option = await within(document.body).findByRole('option', { name: /Grand Hotel/i });
    await userEvent.click(option);
    await expect(args.onChange).toHaveBeenCalledWith({ kind: 'existing', venueId: 'v1' });
  },
};

export const CreateNew: Story = {
  name: 'Create-new: naming a venue bubbles { kind: new }',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /\+ new/i }));

    // In Storybook, Google Maps is unavailable → VenuePlaceSearch falls back to a plain
    // name input. Typing a name bubbles a `new` selection.
    const nameInput = await canvas.findByPlaceholderText('e.g. The O2 Arena');
    await userEvent.type(nameInput, 'Jazz Club');

    await expect(args.onChange).toHaveBeenLastCalledWith({
      kind: 'new',
      venue: expect.objectContaining({ name: 'Jazz Club' }),
    });
  },
};
