import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { InlineAgentBlock } from './InlineAgentBlock';

const newAgentContact = {
  id: 'new-a1',
  userId: 'user_storybook_test',
  name: 'Bob Agency',
  greetingName: null,
  email: 'bob@agency.com',
  phone: null, website: null,
  addressLine1: null, addressLine2: null, city: null, county: null,
  postcode: null, country: null,
  latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null,
  travelTimeCalculatedAt: null, travelMode: null,
  notes: null, parkingInfo: null, accessInfo: null,
  equipmentAvailable: null, commissionArrangement: null,
  primaryRole: 'BOOKING_AGENT',
  createdAt: '2030-06-01T00:00:00Z',
  updatedAt: '2030-06-01T00:00:00Z',
};

const meta = {
  component: InlineAgentBlock,
  tags: ['ai-generated'],
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([])),
        http.post('/api/contacts', () => HttpResponse.json(newAgentContact, { status: 201 })),
      ],
    },
  },
} satisfies Meta<typeof InlineAgentBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AgentBlockDefault: Story = {
  name: 'Booking agent block — Select existing tab active by default',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <InlineAgentBlock
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
    // "Select existing" is the default — picker combobox is visible
    await expect(canvas.getByRole('combobox')).toBeVisible();
    await expect(canvas.getByRole('tab', { name: /\+ new/i })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /create booking agent/i })).toBeNull();
  },
};

export const AgentBlockNewPath: Story = {
  name: 'Booking agent block — + New tab shows Name + Email fields',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      return <InlineAgentBlock {...args} value={value} onChange={setValue} />;
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /\+ new/i }));
    await expect(canvas.getByPlaceholderText('Full name')).toBeVisible();
    await expect(canvas.getByPlaceholderText('email@example.com')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /create booking agent/i })).toBeVisible();
  },
};

export const InlineCreateStaysOnStep: Story = {
  name: 'Booking agent block — Enter in name field does not submit outer form',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      const [outerSubmitted, setOuterSubmitted] = useState(false);
      return (
        <div>
          <span data-testid="outer-submitted">{outerSubmitted ? 'yes' : 'no'}</span>
          <form onSubmit={(e) => { e.preventDefault(); setOuterSubmitted(true); }}>
            <InlineAgentBlock {...args} value={value} onChange={setValue} />
          </form>
        </div>
      );
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: /\+ new/i }));
    await userEvent.type(canvas.getByPlaceholderText('Full name'), 'Bob Agency');
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByTestId('outer-submitted')).toHaveTextContent('no');
  },
};
