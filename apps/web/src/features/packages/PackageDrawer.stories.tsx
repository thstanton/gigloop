import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { PackageDrawer } from './PackageDrawer';
import { packageTemplate } from '@/test/factories';

// The drawer is a container (it owns the create/update mutation), so unlike PackageForm — its
// presentational core, covered separately — what needs pinning here is the save seam: that a
// successful POST hands the *server's* template back through `onCreated`. That callback is what
// the New Booking form auto-selects on (#755), and every test above this layer stubs the drawer
// out, so this story is the only place the real onSuccess path runs.

const EXISTING = packageTemplate({ id: 'tmpl-existing', label: 'Wedding Ceremony', category: 'WEDDING' });

// The happy-path POST /api/packages is already in the global handler set (.storybook/msw-handlers,
// installed via preview.ts) and echoes the request body back over `id: 'new-pkg'` — so only the
// failure stories below need to override it.
const meta: Meta<typeof PackageDrawer> = {
  component: PackageDrawer,
  tags: ['ai-generated'],
  args: { open: true, onClose: fn(), onCreated: fn() },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateSeededFromEventType: Story = {
  name: 'Create mode: opens seeded, and hands the saved template back via onCreated',
  args: { mode: { type: 'create' }, initialValues: { category: 'CORPORATE' } },
  play: async ({ args }) => {
    const body = within(document.body);

    await expect(await body.findByText('New package')).toBeVisible();
    // Seeded from the booking's event type (#755) — a default, not a constraint: it is a plain
    // <select> the musician can change, including back to Uncategorised.
    await expect(body.getByRole('combobox')).toHaveValue('CORPORATE');

    // Save is gated on a label, so a minimum viable template is one field.
    const label = body.getByPlaceholderText('Package name');
    await expect(body.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await userEvent.type(label, 'Corporate Evening');

    await userEvent.click(body.getByRole('button', { name: 'Save changes' }));

    // The crown jewel: onCreated receives what the SERVER returned (id and all), not the local
    // form values — that id is what the New Booking form selects on.
    await waitFor(() =>
      expect(args.onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-pkg', label: 'Corporate Evening', category: 'CORPORATE' }),
      ),
    );
    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
  },
};

export const EditDoesNotFireOnCreated: Story = {
  name: 'Edit mode: a save is not a create, so onCreated stays silent',
  args: { mode: { type: 'edit', pkg: EXISTING } },
  parameters: {
    msw: {
      handlers: [http.patch('/api/packages/tmpl-existing', () => HttpResponse.json(EXISTING))],
    },
  },
  play: async ({ args }) => {
    const body = within(document.body);

    await expect(await body.findByText('Edit package')).toBeVisible();
    // Editing offers deletion; creating does not.
    await expect(body.getByRole('button', { name: 'Delete package' })).toBeVisible();

    await userEvent.click(body.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
    expect(args.onCreated).not.toHaveBeenCalled();
  },
};

export const SaveFailureFallsBackToGenericCopy: Story = {
  name: 'A non-409 failure still says something (never an empty error line)',
  args: { mode: { type: 'create' } },
  parameters: {
    msw: { handlers: [http.post('/api/packages', () => new HttpResponse(null, { status: 500 }))] },
  },
  play: async () => {
    const body = within(document.body);
    await userEvent.type(await body.findByPlaceholderText('Package name'), 'Anything');
    await userEvent.click(body.getByRole('button', { name: 'Save changes' }));
    await expect(await body.findByText(/could not save this package template/i)).toBeVisible();
  },
};

export const SaveFailureStaysInline: Story = {
  name: 'A failed save surfaces inline in the drawer and keeps it open',
  args: { mode: { type: 'create' } },
  parameters: {
    msw: {
      handlers: [
        http.post('/api/packages', () =>
          HttpResponse.json({ message: 'Package label already in use' }, { status: 409 }),
        ),
      ],
    },
  },
  play: async ({ args }) => {
    const body = within(document.body);

    await userEvent.type(await body.findByPlaceholderText('Package name'), 'Duplicate');
    await userEvent.click(body.getByRole('button', { name: 'Save changes' }));

    // Tier 2 would prescribe a toast, but inside an open Sheet an inline error beside the button
    // that failed is the better surface. The message must be real: api.ts rejects with a Response,
    // so the previous `(error as Error).message` rendered undefined — a silent failure.
    await expect(await body.findByText(/already exists/i)).toBeVisible();

    // The drawer stays open (or the typed values are lost) and a failed save is never a create.
    await expect(body.getByPlaceholderText('Package name')).toHaveValue('Duplicate');
    expect(args.onCreated).not.toHaveBeenCalled();
    expect(args.onClose).not.toHaveBeenCalled();
  },
};
