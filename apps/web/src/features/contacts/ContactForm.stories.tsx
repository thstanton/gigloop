import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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
  args: { ...baseArgs },
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

// ─── Progressive disclosure stories ───────────────────────────────────────────

export const RoleCustomer: Story = {
  name: 'Role: Customer — core fields visible, disclosures collapsed',
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

    // Core fields are always visible
    await expect(canvas.getByLabelText('Phone')).toBeVisible();
    await expect(canvas.getByLabelText('Notes')).toBeVisible();

    // Both disclosure buttons are present
    await expect(canvas.getByRole('button', { name: /show venue fields/i })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /show agent fields/i })).toBeVisible();

    // Both disclosures start collapsed for Customer type
    await expect(canvas.queryByLabelText('Parking')).toBeNull();
    await expect(canvas.queryByLabelText('Website')).toBeNull();

    // Open venue disclosure
    await userEvent.click(canvas.getByRole('button', { name: /show venue fields/i }));
    await expect(canvas.getByLabelText('Parking')).toBeVisible();
    await expect(canvas.getByLabelText('Access')).toBeVisible();

    // Collapse it again
    await userEvent.click(canvas.getByRole('button', { name: /hide venue fields/i }));
    await expect(canvas.queryByLabelText('Parking')).toBeNull();
  },
};

export const RoleVenue: Story = {
  name: 'Role: Venue — venue fields auto-expanded',
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

    // Venue fields auto-opened
    await expect(canvas.getByLabelText('Parking')).toBeVisible();
    await expect(canvas.getByLabelText('Access')).toBeVisible();
    await expect(canvas.getByLabelText('Equipment available')).toBeVisible();

    // Core fields still visible
    await expect(canvas.getByLabelText('Phone')).toBeVisible();
    await expect(canvas.getByLabelText('Notes')).toBeVisible();

    // Agent disclosure button is present but collapsed
    await expect(canvas.getByRole('button', { name: /show agent fields/i })).toBeVisible();
    await expect(canvas.queryByLabelText('Website')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /show agent fields/i }));
    await expect(canvas.getByLabelText('Website')).toBeVisible();
  },
};

export const RoleAgent: Story = {
  name: 'Role: Booking agent — agent fields auto-expanded',
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

    // Agent fields auto-opened
    await expect(canvas.getByLabelText('Website')).toBeVisible();
    await expect(canvas.getByLabelText('Commission arrangement')).toBeVisible();

    // Core fields still visible
    await expect(canvas.getByLabelText('Phone')).toBeVisible();
    await expect(canvas.getByLabelText('Notes')).toBeVisible();

    // Venue disclosure button is present but collapsed
    await expect(canvas.getByRole('button', { name: /show venue fields/i })).toBeVisible();
    await expect(canvas.queryByLabelText('Parking')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /show venue fields/i }));
    await expect(canvas.getByLabelText('Parking')).toBeVisible();
  },
};

// ─── Embedded presentation (in-booking card) ──────────────────────────────────

const embeddedCustomerValues = {
  name: 'Alice Barker',
  greetingName: 'Alice',
  email: 'alice@example.com',
  phone: '07700 900111',
  website: '',
  addressLine1: '4 Rose Lane',
  addressLine2: '',
  city: 'Bristol',
  county: '',
  postcode: 'BS1 2AA',
  country: 'GB',
  latitude: null,
  longitude: null,
  placeId: null,
  notes: 'VIP client',
  parkingInfo: '',
  accessInfo: '',
  equipmentAvailable: '',
  commissionArrangement: '',
  primaryRole: 'CUSTOMER' as const,
};

export const EmbeddedFolded: Story = {
  name: 'Embedded — core fields only, detail folded',
  args: {
    ...baseArgs,
    embedded: true,
    submitLabel: 'Save changes',
    defaultValues: embeddedCustomerValues,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Core fields visible (Name carries a required asterisk in its label text)
    await expect(canvas.getByLabelText(/^name/i)).toBeVisible();
    await expect(canvas.getByLabelText('Greeting name')).toBeVisible();
    await expect(canvas.getByLabelText('Email')).toBeVisible();
    await expect(canvas.getByLabelText('Phone')).toBeVisible();

    // Contact Type is absent in embedded mode
    await expect(canvas.queryByText('Contact Type')).toBeNull();

    // Address / Notes folded away until the disclosure opens
    await expect(canvas.queryByLabelText('Notes')).toBeNull();
    await expect(canvas.queryByLabelText('Address')).toBeNull();

    // Single disclosure control, no venue/agent sub-disclosures
    await expect(canvas.getByRole('button', { name: /add contact details/i })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /show venue fields/i })).toBeNull();
    await expect(canvas.queryByRole('button', { name: /show agent fields/i })).toBeNull();
  },
};

export const EmbeddedExpanded: Story = {
  name: 'Embedded — disclosure opened reveals Address + Notes',
  args: {
    ...baseArgs,
    embedded: true,
    submitLabel: 'Save changes',
    defaultValues: embeddedCustomerValues,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /add contact details/i }));
    await expect(canvas.getByText('Address')).toBeVisible();
    await expect(canvas.getByLabelText('Notes')).toBeVisible();

    // Collapse again
    await userEvent.click(canvas.getByRole('button', { name: /hide contact details/i }));
    await expect(canvas.queryByLabelText('Notes')).toBeNull();
  },
};

export const EmbeddedVenue: Story = {
  name: 'Embedded — VENUE keeps its address visible',
  args: {
    ...baseArgs,
    embedded: true,
    submitLabel: 'Save changes',
    defaultValues: {
      ...embeddedCustomerValues,
      name: 'The Grand Hall',
      greetingName: '',
      email: 'info@grandhall.co.uk',
      phone: '',
      parkingInfo: '50 spaces round the back',
      primaryRole: 'VENUE' as const,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Venue address (the "Find venue" search) is visible without opening the disclosure
    await expect(canvas.getByText('Find venue')).toBeVisible();

    // Venue-specific fields stay folded until the disclosure opens
    await expect(canvas.queryByLabelText('Parking')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /add contact details/i }));
    await expect(canvas.getByLabelText('Parking')).toBeVisible();
  },
};

export const EmbeddedSaved: Story = {
  name: 'Embedded — inline "Saved" marker',
  args: {
    ...baseArgs,
    embedded: true,
    saved: true,
    submitLabel: 'Save changes',
    defaultValues: embeddedCustomerValues,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Saved')).toBeVisible();
  },
};

export const EmbeddedPreservesRole: Story = {
  name: 'Embedded — save preserves the hidden primaryRole',
  args: {
    ...baseArgs,
    embedded: true,
    submitLabel: 'Save changes',
    onSubmit: fn(),
    defaultValues: embeddedCustomerValues,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /save changes/i }));

    // Contact Type is hidden, but the CUSTOMER role must round-trip through submit.
    // react-hook-form calls onSubmit as (values, event), so match both positions.
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ primaryRole: 'CUSTOMER' }),
      expect.anything(),
    );
  },
};

export const ContextRolePrefill: Story = {
  name: 'contextRole pre-fills Contact Type (no defaultValues)',
  args: {
    ...baseArgs,
    contextRole: 'VENUE',
    autoSuggestGreetingName: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Venue fields are open (proves contextRole seeded the select as VENUE)
    await expect(canvas.getByLabelText('Parking')).toBeVisible();

    // Contact Type shows Venue — scope to <span> to exclude the hidden native <option>
    await expect(canvas.getByText('Venue', { selector: 'span' })).toBeVisible();
  },
};
