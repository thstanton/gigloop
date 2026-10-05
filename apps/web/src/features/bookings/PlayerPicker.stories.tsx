import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { isEnabled } from '@/lib/featureFlags';
import { BAND_NOTES_FIELDS } from '@/lib/constants';
import { PlayerPicker } from './PlayerPicker';
import type { Contact } from '@/types/api';

// Fills a vacant part (#885, #886, #1036): ranks by soft role/instrument match, offers "Add
// yourself", and creates new contacts as band members.

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
  component: PlayerPicker,
  tags: ['ai-generated'],
  args: {
    value: null,
    onChange: fn(),
    placeholder: 'Fill this part…',
    partRole: 'Sax',
  },
} satisfies Meta<typeof PlayerPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

let createRequestBody: unknown;

const createContactHandler = http.post('/api/contacts', async ({ request }) => {
  createRequestBody = await request.json();
  return HttpResponse.json({ id: 'c-created' }, { status: 201 });
});

// ═══ #1036, ADR-0083 — "Add yourself" quick-action ═══

export const AddYourselfNoExistingSelfContact: Story = {
  name: 'Add yourself · no existing self-contact opens the create sheet, prefilled from Clerk',
  args: {},
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
  args: { onChange: fn() },
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
  args: { onChange: fn() },
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

export const CreateBandMember: Story = {
  name: 'Creating from a band chair preselects Band member',
  parameters: {
    msw: { handlers: [createContactHandler] },
  },
  play: async ({ args, canvasElement }) => {
    createRequestBody = undefined;
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.type(await screen.findByPlaceholderText('Search or add a player'), 'New Dep');
    await userEvent.click(await screen.findByRole('option', { name: /Create "New Dep"/i }));

    await expect(await screen.findByRole('heading', { name: 'New player' })).toBeVisible();
    const dialog = within(screen.getByRole('dialog'));

    // The band-member UI is dark behind VITE_FEATURE_BAND_MEMBERS. When enabled, assert the
    // selected type is reflected in both the select and the initially-open field disclosure.
    if (isEnabled('VITE_FEATURE_BAND_MEMBERS')) {
      await expect(dialog.getByText('Band member', { selector: 'span', exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Hide band member fields' })).toBeVisible();
      await expect(dialog.getByLabelText('Identity — the instrument they\'re known for')).toBeVisible();
      await expect(dialog.getByText('Declared instruments — everything they can cover')).toBeVisible();
      for (const { label } of BAND_NOTES_FIELDS) {
        await expect(dialog.getByLabelText(label)).toBeVisible();
      }
    }

    await userEvent.click(dialog.getByRole('button', { name: 'Create' }));
    await expect(args.onChange).toHaveBeenCalledWith('c-created');
    await expect(createRequestBody).toMatchObject({ name: 'New Dep', primaryRole: 'BAND_MEMBER' });
  },
};

// Each option shows what the person plays, and the ones matching this part are emphasised — the
// reason the list is ordered the way it is.
const person = (id: string, name: string, over: Partial<Contact>): Contact => ({
  ...selfContact, id, name, email: null, isAccountOwner: false, primaryRole: 'BAND_MEMBER', ...over,
});

const people: Contact[] = [
  person('c-guitar', 'Ben Carter', { primaryBandRole: 'Guitar', instruments: ['Guitar', 'Bass'] }),
  person('c-sax', 'Ana Rossi', { primaryBandRole: 'Sax', instruments: ['sax', 'Flute'], email: 'ana@example.com' }),
  person('c-untyped', 'Priya Shah', { primaryRole: null, primaryBandRole: null, instruments: ['Saxophone'] }),
  person('c-customer', 'Sophie Hartley', { primaryRole: 'CUSTOMER', instruments: ['Sax'] }),
  person('c-venue', 'The Old Barn', { primaryRole: 'VENUE' }),
  person('c-agent', 'Gigs Ltd', { primaryRole: 'BOOKING_AGENT' }),
];

export const ShowsInstrumentsAndHidesNonPlayers: Story = {
  name: 'Options show what each player plays (matches bold); customers, venues and agents are left out',
  parameters: { msw: { handlers: [http.get('/api/contacts', () => HttpResponse.json(people))] } },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    await screen.findAllByRole('option');
    // Player options only: the "Add yourself" row has no name line.
    const names = screen.getAllByRole('option').flatMap((o) => o.querySelector('p')?.textContent ?? []);

    // Players who play a Sax come first (soft match: "Saxophone" counts); Ben follows.
    await expect(names).toEqual(['Ana Rossi', 'Priya Shah', 'Ben Carter']);
    await expect(screen.queryByText('Sophie Hartley')).not.toBeInTheDocument();
    await expect(screen.queryByText('The Old Barn')).not.toBeInTheDocument();
    await expect(screen.queryByText('Gigs Ltd')).not.toBeInTheDocument();

    // Identity first, then instruments, de-duplicated ("Sax" and "sax" once).
    const ana = within(screen.getByRole('option', { name: /Ana Rossi/ }));
    await expect(ana.getByText('Sax')).toHaveClass('font-semibold');
    await expect(ana.getByText('Flute')).not.toHaveClass('font-semibold');
    await expect(ana.getAllByText(/^sax$/i)).toHaveLength(1);
    await expect(ana.getByText('ana@example.com')).toBeVisible();

    // Not matching this part: nothing emphasised. An untyped contact still appears.
    const ben = within(screen.getByRole('option', { name: /Ben Carter/ }));
    await expect(ben.getByText('Guitar')).not.toHaveClass('font-semibold');
    await expect(screen.getByRole('option', { name: /Priya Shah/ })).toBeVisible();
  },
};
