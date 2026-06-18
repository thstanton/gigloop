import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { InlineContactBlock } from './InlineContactBlock';

const newContact = {
  id: 'new-c1',
  userId: 'user_storybook_test',
  name: 'Alice Barker',
  greetingName: 'Alice',
  email: 'alice@example.com',
  phone: null, website: null,
  addressLine1: null, addressLine2: null, city: null, county: null,
  postcode: null, country: null,
  latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null,
  travelTimeCalculatedAt: null, travelMode: null,
  notes: null, parkingInfo: null, accessInfo: null,
  equipmentAvailable: null, commissionArrangement: null,
  primaryRole: 'CUSTOMER',
  createdAt: '2030-06-01T00:00:00Z',
  updatedAt: '2030-06-01T00:00:00Z',
};

const meta = {
  component: InlineContactBlock,
  tags: ['ai-generated'],
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([])),
        http.post('/api/contacts', () => HttpResponse.json(newContact, { status: 201 })),
      ],
    },
  },
} satisfies Meta<typeof InlineContactBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomerBlockDefault: Story = {
  name: 'Customer block — + New tab active by default',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <InlineContactBlock
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
    // + New tab is active: inline fields are visible
    await expect(canvas.getByPlaceholderText('Full name')).toBeVisible();
    await expect(canvas.getByPlaceholderText('e.g. Jane')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /create customer/i })).toBeVisible();
    // Select existing tab is present
    await expect(canvas.getByRole('tab', { name: /select existing/i })).toBeVisible();
  },
};

export const ExistingContactAttached: Story = {
  name: 'Customer block — starts on Select existing when a contact is attached',
  args: { value: 'new-c1', onChange: () => {} },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([newContact])),
      ],
    },
  },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>('new-c1');
      return (
        <InlineContactBlock
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
    // Editing a booking that already has a customer: Select existing is active,
    // not the + New create form.
    await expect(canvas.getByRole('combobox')).toBeVisible();
    await expect(canvas.queryByPlaceholderText('Full name')).toBeNull();
  },
};

export const GreetingAutoSuggest: Story = {
  name: 'Customer block — greeting auto-suggests from name',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      return <InlineContactBlock {...args} value={value} onChange={setValue} />;
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nameInput = canvas.getByPlaceholderText('Full name');
    await userEvent.type(nameInput, 'Alice Barker');
    await expect(canvas.getByPlaceholderText('e.g. Jane')).toHaveValue('Alice');
  },
};

export const InlineCreateStaysOnStep: Story = {
  name: 'Customer block — inline create never submits outer form (click)',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      const [outerSubmitted, setOuterSubmitted] = useState(false);
      return (
        <div>
          <span data-testid="outer-submitted">{outerSubmitted ? 'yes' : 'no'}</span>
          <form onSubmit={(e) => { e.preventDefault(); setOuterSubmitted(true); }}>
            <InlineContactBlock
              {...args}
              value={value}
              onChange={(id) => { setValue(id); args.onChange(id); }}
            />
          </form>
        </div>
      );
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByPlaceholderText('Full name'), 'Alice Barker');
    await userEvent.type(canvas.getByPlaceholderText('email@example.com'), 'alice@example.com');
    await userEvent.click(canvas.getByRole('button', { name: /create customer/i }));

    // Contact selected — block now shows selected state (mode switches to existing)
    await expect(canvas.getByTestId('outer-submitted')).toHaveTextContent('no');
  },
};

export const EnterNoBubble: Story = {
  name: 'Customer block — Enter in name field does not submit outer form',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      const [outerSubmitted, setOuterSubmitted] = useState(false);
      return (
        <div>
          <span data-testid="outer-submitted">{outerSubmitted ? 'yes' : 'no'}</span>
          <form onSubmit={(e) => { e.preventDefault(); setOuterSubmitted(true); }}>
            <InlineContactBlock
              {...args}
              value={value}
              onChange={setValue}
            />
          </form>
        </div>
      );
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const nameInput = canvas.getByPlaceholderText('Full name');
    await userEvent.type(nameInput, 'Bob Smith');
    await userEvent.keyboard('{Enter}');

    // Outer form was NOT submitted
    await expect(canvas.getByTestId('outer-submitted')).toHaveTextContent('no');
  },
};

export const SeeMoreDisclosure: Story = {
  name: 'Customer block — See more/less toggles Phone and Notes',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      return <InlineContactBlock {...args} value={value} onChange={setValue} />;
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Phone and Notes hidden initially
    await expect(canvas.queryByLabelText('Phone')).toBeNull();
    await expect(canvas.queryByLabelText('Notes')).toBeNull();

    // Expand
    await userEvent.click(canvas.getByRole('button', { name: /add more customer details/i }));
    await expect(canvas.getByLabelText('Phone')).toBeVisible();
    await expect(canvas.getByLabelText('Notes')).toBeVisible();

    // Collapse
    await userEvent.click(canvas.getByRole('button', { name: /hide customer details/i }));
    await expect(canvas.queryByLabelText('Phone')).toBeNull();
  },
};

export const SelectExistingTab: Story = {
  name: 'Customer block — Select existing tab shows contact picker',
  args: { value: null, onChange: () => {} },
  render: (args) => {
    function Wrapper() {
      const [value, setValue] = useState<string | null>(null);
      return <InlineContactBlock {...args} value={value} onChange={setValue} />;
    }
    return <Wrapper />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('tab', { name: /select existing/i }));
    // The picker trigger should now be visible
    await expect(canvas.getByRole('combobox')).toBeVisible();
    // + New inline fields should be gone
    await expect(canvas.queryByPlaceholderText('Full name')).toBeNull();
  },
};

const otherContact = { ...newContact, id: 'other-c1', name: 'Bob Carter', greetingName: 'Bob' };

export const EditDirtyShowsSave: Story = {
  name: 'Customer block — edit mode: changed selection shows Save',
  args: { value: 'other-c1', onChange: () => {}, committedValue: 'new-c1', onSave: () => {} },
  parameters: {
    msw: { handlers: [http.get('/api/contacts', () => HttpResponse.json([newContact, otherContact]))] },
  },
  play: async ({ canvas }) => {
    // Selection (other-c1) differs from committed (new-c1) → per-box Save appears, enabled.
    const save = canvas.getByRole('button', { name: /^save$/i });
    await expect(save).toBeVisible();
    await expect(save).toBeEnabled();
  },
};

export const EditEmptyCustomerWarns: Story = {
  name: 'Customer block — edit mode: empty customer disables Save with a warning',
  args: { value: null, onChange: () => {}, committedValue: 'new-c1', onSave: () => {} },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/a booking must have a customer/i)).toBeVisible();
    await expect(canvas.getByRole('button', { name: /^save$/i })).toBeDisabled();
  },
};
