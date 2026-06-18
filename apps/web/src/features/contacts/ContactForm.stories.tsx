import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import ContactForm from './ContactForm';

const meta = {
  component: ContactForm,
  tags: ['ai-generated'],
} satisfies Meta<typeof ContactForm>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  onSubmit: () => {},
  isPending: false,
  isError: false,
};

export const Empty: Story = {
  args: {
    ...baseArgs,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(canvas.getAllByRole('textbox').length).toBeGreaterThan(3);
  },
};

export const CssCheck: Story = {
  args: { ...baseArgs },
  play: async ({ canvas }) => {
    const btn = canvas.getByRole('button', { name: /save/i });
    await expect(btn.className).toContain('bg-primary');
  },
};

export const WithDefaultValues: Story = {
  args: {
    ...baseArgs,
    defaultValues: {
      name: 'Sophie Hartley',
      greetingName: 'Sophie',
      email: 'sophie@example.com',
      phone: '+44 7700 900456',
      website: '',
      addressLine1: '12 Acacia Avenue',
      addressLine2: '',
      city: 'London',
      county: 'Greater London',
      postcode: 'E1 6RF',
      country: 'GB',
      latitude: 51.5074,
      longitude: -0.1278,
      placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
      notes: 'Repeat customer',
      parkingInfo: '',
      accessInfo: '',
      equipmentAvailable: '',
      commissionArrangement: '',
      primaryRole: 'CUSTOMER',
    },
  },
};

export const Saving: Story = {
  args: { ...baseArgs, isPending: true },
};

export const SaveError: Story = {
  args: { ...baseArgs, isPending: false, isError: true },
};

// ─── Role-aware progressive disclosure stories ────────────────────────────────

export const RoleCustomer: Story = {
  name: 'Role: Customer — fields expanded, disclosures present',
  args: {
    ...baseArgs,
    defaultValues: {
      name: 'Alice Barker',
      greetingName: 'Alice',
      email: 'alice@example.com',
      phone: '07700 900111',
      website: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      county: '',
      postcode: '',
      country: 'GB',
      latitude: null,
      longitude: null,
      placeId: null,
      notes: 'VIP client',
      parkingInfo: '',
      accessInfo: '',
      equipmentAvailable: '',
      commissionArrangement: '',
      primaryRole: 'CUSTOMER',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Customer fields are expanded by default
    await expect(canvas.getByLabelText('Phone')).toBeVisible();
    await expect(canvas.getByLabelText('Notes')).toBeVisible();

    // Disclosures for other types are present
    const venueBtn = canvas.getByRole('button', { name: /see more venue details/i });
    await expect(venueBtn).toBeVisible();
    const agentBtn = canvas.getByRole('button', { name: /see more agent details/i });
    await expect(agentBtn).toBeVisible();

    // Parking is hidden until disclosure is opened
    await expect(canvas.queryByLabelText('Parking')).toBeNull();

    // Click venue disclosure — parking becomes visible
    await userEvent.click(venueBtn);
    await expect(canvas.getByLabelText('Parking')).toBeVisible();
    await expect(canvas.getByLabelText('Access')).toBeVisible();

    // Collapse back
    const seeLessBtn = canvas.getByRole('button', { name: /see less/i });
    await userEvent.click(seeLessBtn);
    await expect(canvas.queryByLabelText('Parking')).toBeNull();
  },
};

export const RoleVenue: Story = {
  name: 'Role: Venue — fields expanded, disclosures present',
  args: {
    ...baseArgs,
    defaultValues: {
      name: 'The Grand Hall',
      greetingName: '',
      email: 'info@grandhall.co.uk',
      phone: '',
      website: '',
      addressLine1: '1 Grand Street',
      addressLine2: '',
      city: 'Manchester',
      county: '',
      postcode: 'M1 1AA',
      country: 'GB',
      latitude: null,
      longitude: null,
      placeId: null,
      notes: '',
      parkingInfo: '50 spaces round the back',
      accessInfo: 'Stage door on left',
      equipmentAvailable: 'PA, lighting rig',
      commissionArrangement: '',
      primaryRole: 'VENUE',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Venue extras are expanded
    await expect(canvas.getByLabelText('Parking')).toBeVisible();
    await expect(canvas.getByLabelText('Access')).toBeVisible();
    await expect(canvas.getByLabelText('Equipment available')).toBeVisible();

    // Disclosures for other types are present
    await expect(canvas.getByRole('button', { name: /see more customer details/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /see more agent details/i })).toBeVisible();

    // Phone is hidden (in customer disclosure)
    await expect(canvas.queryByLabelText('Phone')).toBeNull();

    // Open customer disclosure → phone appears
    await userEvent.click(canvas.getByRole('button', { name: /see more customer details/i }));
    await expect(canvas.getByLabelText('Phone')).toBeVisible();
  },
};

export const RoleAgent: Story = {
  name: 'Role: Booking agent — fields expanded, disclosures present',
  args: {
    ...baseArgs,
    defaultValues: {
      name: 'Talent Direct',
      greetingName: 'TD',
      email: 'bookings@talentdirect.com',
      phone: '020 7000 0001',
      website: 'https://talentdirect.com',
      addressLine1: '10 Agency Row',
      addressLine2: '',
      city: 'London',
      county: '',
      postcode: 'WC2N 5DU',
      country: 'GB',
      latitude: null,
      longitude: null,
      placeId: null,
      notes: '',
      parkingInfo: '',
      accessInfo: '',
      equipmentAvailable: '',
      commissionArrangement: '15% of gross fee',
      primaryRole: 'BOOKING_AGENT',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Agent fields are expanded
    await expect(canvas.getByLabelText('Phone')).toBeVisible();
    await expect(canvas.getByLabelText('Website')).toBeVisible();
    await expect(canvas.getByLabelText('Commission arrangement')).toBeVisible();

    // Disclosures for other types are present
    await expect(canvas.getByRole('button', { name: /see more customer details/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /see more venue details/i })).toBeVisible();

    // Open agent disclosure → commission is already visible (no duplicate)
    // Open venue disclosure → parking appears
    await userEvent.click(canvas.getByRole('button', { name: /see more venue details/i }));
    await expect(canvas.getByLabelText('Parking')).toBeVisible();
  },
};

export const ContextRolePrefill: Story = {
  name: 'contextRole pre-fills Contact Type (no defaultValues)',
  args: {
    ...baseArgs,
    contextRole: 'CUSTOMER',
    autoSuggestGreetingName: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Customer fields are visible (proves contextRole pre-filled the select)
    await expect(canvas.getByLabelText('Phone')).toBeVisible();
    await expect(canvas.getByLabelText('Notes')).toBeVisible();

    // Contact Type select shows Customer
    await expect(canvas.getByText('Customer')).toBeVisible();
  },
};
