import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { PeopleAtom } from './PeopleAtom';
import type { Contact } from '@/types/api';

function contact(over: Partial<Contact>): Contact {
  return {
    id: 'c1', name: 'Sophie Hartley', greetingName: 'Sophie',
    email: 'sophie@example.com', phone: '07700 900456', website: null,
    addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: 'GB',
    latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null,
    travelTimeCalculatedAt: null, travelMode: null, notes: null, parkingInfo: null, accessInfo: null,
    equipmentAvailable: null, commissionArrangement: null, primaryRole: 'CUSTOMER',
    createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z', ...over,
  };
}

const customer = contact({ id: 'cust-1', name: 'Sophie Hartley', primaryRole: 'CUSTOMER' });
const agent = contact({
  id: 'agent-1', name: 'Talent Direct', greetingName: 'TD',
  email: 'bookings@talent.com', primaryRole: 'BOOKING_AGENT',
});

const meta = {
  component: PeopleAtom,
  tags: ['ai-generated'],
  args: { customer, agent, onSave: fn(), isSaving: false, saved: false, saveError: null },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([])),
        http.patch('/api/contacts/:id', async ({ request }) =>
          HttpResponse.json({ ...customer, ...(await request.json() as object) })),
      ],
    },
  },
} satisfies Meta<typeof PeopleAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BothAssigned: Story = {
  name: 'Assigned — each role renders an editable card',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Customer')).toBeVisible();
    await expect(canvas.getByText('Booking agent')).toBeVisible();
    // Every card owns its own "Save contact" — no shared section Save.
    await expect(canvas.getAllByRole('button', { name: /save contact/i })).toHaveLength(2);
    await expect(canvas.queryByRole('button', { name: /^save$/i })).toBeNull();
    await expect(canvas.getByRole('button', { name: /change customer/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /change booking agent/i })).toBeVisible();
  },
};

export const Unassigned: Story = {
  name: 'Unassigned — assign-mode pickers, each Save disabled until a change',
  args: { customer: null, agent: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('combobox')).toHaveLength(2);
    const saves = canvas.getAllByRole('button', { name: /^save$/i });
    await expect(saves).toHaveLength(2);
    for (const s of saves) await expect(s).toBeDisabled();
  },
};

export const ChangeCustomer: Story = {
  name: 'Change customer → assign-mode picker (clean form, no discard confirm)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /change customer/i }));
    // Customer box is now a picker with its own assign Save + Cancel; agent card is untouched.
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /^cancel$/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /change booking agent/i })).toBeVisible();
  },
};

export const AssignCustomerFromUnassigned: Story = {
  name: 'Inline-create a customer and save (emits only the changed role)',
  args: { customer: null, agent: null },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const newTabs = canvas.getAllByRole('tab', { name: /\+ new/i });
    await userEvent.click(newTabs[0]); // customer is the first box
    const nameInput = await canvas.findByPlaceholderText('e.g. Jane Smith');
    await userEvent.type(nameInput, 'Jane Smith');

    const save = canvas.getAllByRole('button', { name: /^save$/i })[0];
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    await expect(args.onSave).toHaveBeenCalledWith({
      customer: { kind: 'new', contact: expect.objectContaining({ name: 'Jane Smith' }) },
    });
  },
};

export const ErrorState: Story = {
  name: 'Assignment failure shows an inline error in assign mode',
  args: { customer: null, agent: null, saveError: 'Failed to save. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(/failed to save/i).length).toBeGreaterThan(0);
  },
};
