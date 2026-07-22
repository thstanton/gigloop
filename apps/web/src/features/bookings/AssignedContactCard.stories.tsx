import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AssignedContactCard } from './AssignedContactCard';
import type { Contact } from '@/types/api';

const customer: Contact = {
  id: 'contact-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'Sophie Hartley',
  greetingName: 'Sophie',
  email: 'sophie@example.com',
  phone: '+44 7700 900456',
  notes: 'Repeat customer',
  addressLine1: '12 Acacia Avenue',
  addressLine2: '',
  city: 'London',
  county: 'Greater London',
  postcode: 'E1 6RF',
  country: 'GB',
  latitude: 51.5074,
  longitude: -0.1278,
  placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
  travelTimeMinutes: null,
  travelDistanceMetres: null,
  travelTimeCalculatedAt: null,
  travelMode: null,
  parkingInfo: '',
  accessInfo: '',
  equipmentAvailable: '',
  website: '',
  commissionArrangement: '',
  primaryRole: 'CUSTOMER',
};

const venue: Contact = {
  ...customer,
  id: 'contact-venue',
  name: 'The Grand Hall',
  greetingName: '',
  email: 'info@grandhall.co.uk',
  phone: '',
  notes: '',
  addressLine1: '1 Grand Street',
  city: 'Manchester',
  county: '',
  postcode: 'M1 1AA',
  parkingInfo: '50 spaces round the back',
  accessInfo: 'Stage door on left',
  equipmentAvailable: 'PA, lighting rig',
  primaryRole: 'VENUE',
};

const meta = {
  component: AssignedContactCard,
  tags: ['ai-generated'],
  args: {
    contact: customer,
    roleLabel: 'Customer',
    contextRole: 'CUSTOMER',
    onSave: fn(),
    onChangeContact: fn(),
    isSaving: false,
    saved: false,
    saveError: false,
    dirty: false,
  },
} satisfies Meta<typeof AssignedContactCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Customer')).toBeVisible();
    // Core field prefilled from the assigned contact
    await expect(canvas.getByLabelText(/^name/i)).toHaveValue('Sophie Hartley');
    // Detail folded away by the embedded form
    await expect(canvas.queryByLabelText('Notes')).toBeNull();
    // Change control present, no confirm yet
    await expect(canvas.getByRole('button', { name: /change customer/i })).toBeVisible();
    await expect(canvas.queryByText(/discard changes/i)).toBeNull();
  },
};

export const Saving: Story = {
  args: { isSaving: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: /saving/i })).toBeDisabled();
  },
};

export const Saved: Story = {
  args: { saved: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Saved')).toBeVisible();
  },
};

export const SaveError: Story = {
  args: { saveError: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/something went wrong/i)).toBeVisible();
  },
};

export const DirtyConfirm: Story = {
  name: 'Dirty — "Change …" asks to discard first',
  args: { dirty: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /change customer/i }));

    // Inline confirm, not an immediate re-assign
    await expect(canvas.getByText(/discard changes and pick someone else/i)).toBeVisible();
    await expect(args.onChangeContact).not.toHaveBeenCalled();

    // Cancel returns to edit; the form values are untouched
    await userEvent.click(canvas.getByRole('button', { name: /^cancel$/i }));
    await expect(canvas.queryByText(/discard changes/i)).toBeNull();
    await expect(canvas.getByLabelText(/^name/i)).toHaveValue('Sophie Hartley');
  },
};

export const Venue: Story = {
  name: 'Venue — MapPin header, address visible',
  args: {
    contact: venue,
    roleLabel: 'Venue',
    contextRole: 'VENUE',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Venue')).toBeVisible();
    // Venue carve-out: the address search is visible without opening the disclosure
    await expect(canvas.getByText('Find venue')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /change venue/i })).toBeVisible();
  },
};

export const HappyPathSave: Story = {
  name: 'Happy path — edit email and save',
  args: { onSave: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    const email = canvas.getByLabelText('Email');
    await userEvent.clear(email);
    await userEvent.type(email, 'sophie.new@example.com');

    await userEvent.click(canvas.getByRole('button', { name: /save contact/i }));

    // react-hook-form calls onSubmit as (values, event) — match both positions.
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'sophie.new@example.com' }),
      expect.anything(),
    );
  },
};
