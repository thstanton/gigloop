import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { RoleField } from './PeopleFields';

// A full Contact shape so the picker can resolve a seeded customer.
const customerContact = {
  id: 'c1',
  userId: 'user_storybook_test',
  name: 'Jane Smith',
  greetingName: 'Jane',
  email: 'jane@example.com',
  phone: null,
  website: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  county: null,
  postcode: null,
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
  primaryRole: 'CUSTOMER',
  createdAt: '2030-06-01T00:00:00Z',
  updatedAt: '2030-06-01T00:00:00Z',
};

const meta = {
  component: RoleField,
  tags: ['ai-generated'],
  args: {
    label: 'Customer',
    preferredRole: 'CUSTOMER',
    required: true,
    variant: 'customer',
    initialContactId: null,
    onChange: fn(),
  },
  parameters: {
    msw: {
      handlers: [http.get('/api/contacts', () => HttpResponse.json([customerContact]))],
    },
  },
} satisfies Meta<typeof RoleField>;

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
  name: 'Pick-existing: selecting a contact bubbles { kind: existing }',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    // The picker's popover renders in a body portal.
    const option = await within(document.body).findByRole('option', { name: /Jane Smith/i });
    await userEvent.click(option);
    await expect(args.onChange).toHaveBeenCalledWith({ kind: 'existing', contactId: 'c1' });
  },
};

export const CreateNewCustomer: Story = {
  name: 'Create-new (customer): name + notes bubble { kind: new }',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /\+ new/i }));

    const nameInput = await canvas.findByPlaceholderText('e.g. Jane Smith');
    await userEvent.type(nameInput, 'Acme Corp');

    // Notes live under "Add contact details" (customer variant).
    await userEvent.click(canvas.getByRole('button', { name: /add contact details/i }));
    const notes = canvas.getByLabelText('Notes');
    await userEvent.type(notes, 'Met at a wedding fair');

    await expect(args.onChange).toHaveBeenLastCalledWith({
      kind: 'new',
      contact: expect.objectContaining({ name: 'Acme Corp', notes: 'Met at a wedding fair' }),
    });
  },
};

export const CreateNewAgent: Story = {
  name: 'Create-new (agent): commission is captured (agent variant)',
  args: { label: 'Booking agent', preferredRole: 'BOOKING_AGENT', required: false, variant: 'agent' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /\+ new/i }));

    const nameInput = await canvas.findByPlaceholderText('e.g. Jane Smith');
    await userEvent.type(nameInput, 'Top Agency');

    await userEvent.click(canvas.getByRole('button', { name: /add contact details/i }));
    const commission = canvas.getByLabelText('Commission arrangement');
    await userEvent.type(commission, '15% of fee');

    await expect(args.onChange).toHaveBeenLastCalledWith({
      kind: 'new',
      contact: expect.objectContaining({ name: 'Top Agency', commissionArrangement: '15% of fee' }),
    });
  },
};
