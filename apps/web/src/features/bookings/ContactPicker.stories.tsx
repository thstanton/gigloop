import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import ContactPicker from './ContactPicker';
import type { Contact } from '@/types/api';

// A reusable contact-search-and-select combobox (with inline "create new" fallback), reused as-is
// by the Band sheet (#885) to fill a vacant chair — no forking needed.

function Controlled({ initial }: { initial: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return <ContactPicker value={value} onChange={setValue} placeholder="Select contact..." />;
}

// #1036, ADR-0083: the account-owner Contact — reused, never re-created, once it exists.
const selfContact: Contact = {
  id: 'c-self', name: 'Tim Stanton', greetingName: 'Tim',
  email: 'tim@example.com', phone: null, website: null,
  addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: 'GB',
  latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null,
  travelTimeCalculatedAt: null, travelMode: null, notes: null, parkingInfo: null, accessInfo: null,
  equipmentAvailable: null, commissionArrangement: null, primaryRole: 'BAND_MEMBER',
  primaryBandRole: null, instruments: [], travelNotes: null, equipmentNotes: null,
  outfitNotes: null, availabilityNotes: null, isAccountOwner: true,
  createdAt: '2030-06-01T00:00:00Z', updatedAt: '2030-06-01T00:00:00Z',
};

const meta = {
  component: ContactPicker,
  tags: ['ai-generated'],
  args: {
    value: null,
    onChange: fn(),
    placeholder: 'Select contact...',
  },
} satisfies Meta<typeof ContactPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox')).toHaveTextContent('Select contact...');
  },
};

export const SearchAndSelect: Story = {
  name: 'Typing a search term filters the list, and selecting fires onChange',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.type(await screen.findByPlaceholderText(/Search or create new/i), 'Sophie');
    await userEvent.click(await screen.findByRole('option', { name: /Sophie Hartley/i }));
    await expect(args.onChange).toHaveBeenCalledWith('c2');
  },
};

export const WithSelection: Story = {
  name: 'A selected contact shows its name and a clear affordance',
  render: () => <Controlled initial="c2" />,
  play: async ({ canvas }) => {
    // The contact list loads async (useContacts) — the trigger label updates once it resolves.
    await expect(await canvas.findByRole('combobox', { name: /Sophie Hartley/i })).toBeVisible();
  },
};

// ═══ #1036, ADR-0083 — "Add yourself" quick-action ═══

export const AddYourselfNoExistingSelfContact: Story = {
  name: 'Add yourself · no existing self-contact opens the create sheet, prefilled from Clerk',
  args: { allowSelf: true },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([])),
        http.post('/api/contacts', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            { ...selfContact, id: 'new-self', ...body },
            { status: 201 },
          );
        }),
      ],
    },
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /Add yourself/i }));
    // The clerk-mock identity (Tim Stanton / tim@example.com) prefills the create sheet.
    await expect(await screen.findByRole('heading', { name: /Add yourself/i })).toBeVisible();
    const nameField = (await screen.findByLabelText(/^Name/i)) as HTMLInputElement;
    await expect(nameField.value).toBe('Tim Stanton');
  },
};

export const AddYourselfExistingSelfContact: Story = {
  name: 'Add yourself · an existing self-contact is assigned directly, no dialog',
  args: { allowSelf: true, onChange: fn() },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([selfContact])),
      ],
    },
  },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /Add yourself/i }));
    await expect(args.onChange).toHaveBeenCalledWith('c-self');
    await expect(screen.queryByRole('heading', { name: /Add yourself/i })).not.toBeInTheDocument();
  },
};

export const AddYourselfRacedCreate409: Story = {
  name: 'Add yourself · a raced 409 on create resolves to the existing self-contact',
  args: { allowSelf: true, onChange: fn() },
  parameters: {
    msw: {
      handlers: [
        // The first GET (mount) finds nobody; after the 409, ContactPicker refetches ['contacts']
        // and this second GET reflects the contact another tab won the race to create.
        http.get(
          '/api/contacts',
          (() => {
            let call = 0;
            return () => HttpResponse.json(call++ === 0 ? [] : [selfContact]);
          })(),
        ),
        http.post('/api/contacts', () =>
          HttpResponse.json({ message: 'Another Contact is already the account owner' }, { status: 409 })),
      ],
    },
  },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /Add yourself/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Create/i }));
    await expect(args.onChange).toHaveBeenCalledWith('c-self');
    await expect(screen.queryByRole('heading', { name: /Add yourself/i })).not.toBeInTheDocument();
  },
};
