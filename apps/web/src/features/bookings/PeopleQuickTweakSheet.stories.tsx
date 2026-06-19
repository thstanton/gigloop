import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { PeopleQuickTweakSheet } from './PeopleQuickTweakSheet';

// Module-level so an MSW handler can record how many times the create endpoint was hit.
let postCount = 0;

const newContact = {
  id: 'new-c1',
  userId: 'user_storybook_test',
  name: 'Jane Smith',
  greetingName: 'Jane',
  email: null,
  phone: null,
  website: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  county: null,
  postcode: null,
  country: null,
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
  primaryRole: 'CUSTOMER',
  createdAt: '2030-06-01T00:00:00Z',
  updatedAt: '2030-06-01T00:00:00Z',
};

const meta = {
  component: PeopleQuickTweakSheet,
  tags: ['ai-generated'],
  args: {
    bookingId: 'b1',
    currentCustomerId: 'cust-1',
    currentAgentId: null,
    open: true,
    onOpenChange: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([])),
        http.post('/api/contacts', () => {
          postCount += 1;
          return HttpResponse.json(newContact, { status: 201 });
        }),
        http.patch('/api/bookings/:id', () => HttpResponse.json({})),
      ],
    },
  },
} satisfies Meta<typeof PeopleQuickTweakSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Opens the people atom in a sheet',
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('heading', { name: 'People' })).toBeVisible();
    // Customer + agent role pickers.
    await expect(body.getAllByRole('combobox')).toHaveLength(2);
  },
};

export const InlineCreateCustomerAndSave: Story = {
  name: 'Inline-create a customer and save end-to-end (POST contact → PATCH booking)',
  play: async ({ args, canvasElement }) => {
    postCount = 0;
    const body = within(canvasElement.ownerDocument.body);
    const newTabs = await body.findAllByRole('tab', { name: /\+ new/i });
    await userEvent.click(newTabs[0]); // customer

    const nameInput = await body.findByPlaceholderText('e.g. Jane Smith');
    await userEvent.type(nameInput, 'Jane Smith');

    await userEvent.click(body.getByRole('button', { name: /^save$/i }));

    // Tier-2: a successful create+assign closes the sheet.
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledWith(false));
    // The contact was created exactly once.
    expect(postCount).toBe(1);
  },
};
