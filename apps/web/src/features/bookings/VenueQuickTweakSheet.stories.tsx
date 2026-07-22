import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { VenueQuickTweakSheet } from './VenueQuickTweakSheet';

// Module-level so an MSW handler can record how many times the create endpoint was hit.
let postCount = 0;

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
  component: VenueQuickTweakSheet,
  tags: ['ai-generated'],
  args: {
    bookingId: 'b1',
    venue: null,
    open: true,
    onOpenChange: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([venueContact])),
        http.post('/api/contacts', () =>
          HttpResponse.json({ ...venueContact, id: 'new-v1', name: 'Jazz Club' }, { status: 201 }),
        ),
        http.patch('/api/bookings/:id', () => HttpResponse.json({})),
      ],
    },
  },
} satisfies Meta<typeof VenueQuickTweakSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Opens the venue atom in a sheet',
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('heading', { name: 'Venue' })).toBeVisible();
    // The atom's existing-venue picker is the default surface.
    await expect(body.getByRole('combobox')).toBeVisible();
  },
};

export const InlineCreateAndSave: Story = {
  name: 'Inline-create a venue and save end-to-end (POST contact → PATCH booking)',
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([venueContact])),
        // Count creates so we prove the orchestration POSTs exactly once.
        http.post('/api/contacts', () => {
          postCount += 1;
          return HttpResponse.json({ ...venueContact, id: 'new-v1', name: 'Jazz Club' }, { status: 201 });
        }),
        http.patch('/api/bookings/:id', () => HttpResponse.json({})),
      ],
    },
  },
  play: async ({ args, canvasElement }) => {
    postCount = 0;
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('tab', { name: /\+ new/i }));

    const nameInput = await body.findByPlaceholderText('e.g. The O2 Arena');
    await userEvent.type(nameInput, 'Jazz Club');

    await userEvent.click(body.getByRole('button', { name: /^save$/i }));

    // Tier-2: a successful create+assign closes the sheet (the updated venue card is the
    // feedback). The host's onOpenChange(false) is the observable signal.
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledWith(false));
    // The contact was created exactly once — no duplicate from the orchestration.
    expect(postCount).toBe(1);
  },
};
