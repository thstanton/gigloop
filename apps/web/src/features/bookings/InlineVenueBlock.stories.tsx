import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { InlineVenueBlock } from './InlineVenueBlock';

const newVenueContact = {
  id: 'new-v1',
  userId: 'user_storybook_test',
  name: 'The Grand Hotel',
  greetingName: null,
  email: null,
  phone: null, website: null,
  addressLine1: '123 Main Street', addressLine2: null, city: 'London', county: null,
  postcode: 'SW1A 1AA', country: 'GB',
  latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null,
  travelTimeCalculatedAt: null, travelMode: null,
  notes: null, parkingInfo: null, accessInfo: null,
  equipmentAvailable: null, commissionArrangement: null,
  primaryRole: 'VENUE',
  createdAt: '2030-06-01T00:00:00Z',
  updatedAt: '2030-06-01T00:00:00Z',
};

const meta = {
  component: InlineVenueBlock,
  tags: ['ai-generated'],
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([])),
        http.post('/api/contacts', () => HttpResponse.json(newVenueContact, { status: 201 })),
      ],
    },
  },
} satisfies Meta<typeof InlineVenueBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VenueBlockDefault: Story = {
  name: 'Venue block — Select existing tab active by default',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <InlineVenueBlock
          {...args}
          value={value}
          onChange={(id) => { setValue(id); args.onChange(id); }}
        />
      );
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // "Select existing" is the default tab — picker combobox is visible
    await expect(canvas.getByRole('combobox')).toBeVisible();
    // "+ New" tab is present
    await expect(canvas.getByRole('tab', { name: /\+ new/i })).toBeVisible();
    // No inline create form
    await expect(canvas.queryByRole('button', { name: /create venue/i })).toBeNull();
  },
};

export const VenueBlockNewPath: Story = {
  name: 'Venue block — + New tab shows venue name input and create button',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      return <InlineVenueBlock {...args} value={value} onChange={setValue} />;
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /\+ new/i }));
    // In test env Google Maps is unavailable — VenuePlaceSearch searchOnly renders a plain name input
    await expect(canvas.getByPlaceholderText('e.g. The O2 Arena')).toBeVisible();
    // Create venue button is visible
    await expect(canvas.getByRole('button', { name: /create venue/i })).toBeVisible();
  },
};

export const VenueBlockDisclosure: Story = {
  name: 'Venue block — disclosure reveals address and extra fields',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      return <InlineVenueBlock {...args} value={value} onChange={setValue} />;
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /\+ new/i }));
    await expect(canvas.queryByLabelText(/parking/i)).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /add more venue details/i }));
    await expect(canvas.getByLabelText(/parking/i)).toBeVisible();
    await expect(canvas.getByLabelText(/access/i)).toBeVisible();
    await expect(canvas.getByLabelText(/equipment available/i)).toBeVisible();
  },
};

export const InlineCreateStaysOnStep: Story = {
  name: 'Venue block — Enter in venue name input does not submit outer form',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      const [outerSubmitted, setOuterSubmitted] = useState(false);
      return (
        <div>
          <span data-testid="outer-submitted">{outerSubmitted ? 'yes' : 'no'}</span>
          <form onSubmit={(e) => { e.preventDefault(); setOuterSubmitted(true); }}>
            <InlineVenueBlock {...args} value={value} onChange={setValue} />
          </form>
        </div>
      );
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /\+ new/i }));
    // In test env, VenuePlaceSearch searchOnly renders the plain name input
    const nameInput = canvas.getByPlaceholderText('e.g. The O2 Arena');
    await userEvent.type(nameInput, 'Grand Hotel');
    await userEvent.keyboard('{Enter}');
    // Outer form must NOT have been submitted
    await expect(canvas.getByTestId('outer-submitted')).toHaveTextContent('no');
  },
};

export const EditRemovalAllowed: Story = {
  name: 'Venue block — edit mode: detaching a venue allows Save (no warning)',
  args: { value: null, onChange: () => {}, committedValue: 'new-v1', onSave: () => {} },
  parameters: {
    msw: { handlers: [http.get('/api/contacts', () => HttpResponse.json([newVenueContact]))] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Venue is nullable: an empty selection (removal) is a valid, saveable change.
    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeVisible();
    await expect(save).toBeEnabled();
  },
};
