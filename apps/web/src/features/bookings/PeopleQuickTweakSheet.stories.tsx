import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { PeopleQuickTweakSheet } from './PeopleQuickTweakSheet';
import type { Contact } from '@/types/api';

// Module-level so an MSW handler can record how many times the create endpoint was hit.
let postCount = 0;

const customer: Contact = {
  id: 'cust-1', name: 'Sophie Hartley', greetingName: 'Sophie',
  email: 'sophie@example.com', phone: null, website: null,
  addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: 'GB',
  latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null,
  travelTimeCalculatedAt: null, travelMode: null, notes: null, parkingInfo: null, accessInfo: null,
  equipmentAvailable: null, commissionArrangement: null, primaryRole: 'CUSTOMER',
  createdAt: '2030-06-01T00:00:00Z', updatedAt: '2030-06-01T00:00:00Z',
};

const newContact = { ...customer, id: 'new-c1', name: 'Jane Smith', greetingName: 'Jane', email: null };

const meta = {
  component: PeopleQuickTweakSheet,
  tags: ['ai-generated'],
  args: {
    bookingId: 'b1',
    customer,
    agent: null,
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
        http.patch('/api/contacts/:id', async ({ request }) =>
          HttpResponse.json({ ...customer, ...(await request.json() as object) })),
        http.patch('/api/bookings/:id', () => HttpResponse.json({})),
      ],
    },
  },
} satisfies Meta<typeof PeopleQuickTweakSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Assigned customer edits in place; agent shows an assign picker',
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('heading', { name: 'People' })).toBeVisible();
    // Customer is assigned → an editable card with its own "Save contact".
    await expect(body.getByRole('button', { name: /save contact/i })).toBeVisible();
    await expect(body.getByRole('button', { name: /change customer/i })).toBeVisible();
    // Agent is unassigned → an assign-mode picker.
    await expect(body.getByRole('combobox')).toBeVisible();
  },
};

export const InlineCreateCustomerAndSave: Story = {
  name: 'Inline-create a customer and save end-to-end (POST contact → PATCH booking)',
  args: { customer: null, agent: null },
  play: async ({ args, canvasElement }) => {
    postCount = 0;
    const body = within(canvasElement.ownerDocument.body);
    const newTabs = await body.findAllByRole('tab', { name: /\+ new/i });
    await userEvent.click(newTabs[0]); // customer

    const nameInput = await body.findByPlaceholderText('e.g. Jane Smith');
    await userEvent.type(nameInput, 'Jane Smith');

    // The customer box owns its own assign Save (first of the two boxes).
    await userEvent.click(body.getAllByRole('button', { name: /^save$/i })[0]);

    // Tier-2: a successful create+assign closes the sheet.
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledWith(false));
    // The contact was created exactly once.
    expect(postCount).toBe(1);
  },
};
