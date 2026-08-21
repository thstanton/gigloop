import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { LineupDrawer } from './LineupDrawer';
import { lineupTemplate } from '@/test/factories';

// Band members v1 (#879, ADR-0072 §3). The story task named "a .stories.tsx for the lineup list
// and the slot editor" is satisfied by LineupList.stories.tsx and LineupSlotEditor.stories.tsx —
// but "one play covering create-a-lineup" means the real save seam, and that only runs here:
// LineupDrawer owns the POST/PATCH branch, the disabled-Save gate and the mutation. Mirrors
// PackageDrawer.stories.tsx's own reasoning for existing.

const EXISTING = lineupTemplate({ id: 'lineup-existing', label: 'My five-piece' });

const meta: Meta<typeof LineupDrawer> = {
  component: LineupDrawer,
  tags: ['ai-generated'],
  args: { open: true, onClose: fn() },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateALineup: Story = {
  name: 'Create mode: filling label + a part and saving POSTs the built payload',
  args: { mode: { type: 'create' } },
  play: async ({ args }) => {
    const body = within(document.body);

    await expect(await body.findByText('New lineup')).toBeVisible();

    // Save is gated on a label — a minimum viable lineup is one field, same as PackageDrawer.
    await expect(body.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await userEvent.type(body.getByPlaceholderText('e.g. My five-piece'), 'My five-piece');

    await userEvent.click(body.getByRole('button', { name: '+ Add part' }));
    await userEvent.type(body.getByPlaceholderText('e.g. Saxophone'), 'Saxophone');

    await userEvent.click(body.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
  },
};

export const EditModeOffersDeletion: Story = {
  args: { mode: { type: 'edit', lineup: EXISTING } },
  parameters: {
    msw: {
      handlers: [http.patch('/api/lineups/lineup-existing', () => HttpResponse.json(EXISTING))],
    },
  },
  play: async ({ args }) => {
    const body = within(document.body);

    await expect(await body.findByText('Edit lineup')).toBeVisible();
    await expect(body.getByRole('button', { name: 'Delete lineup' })).toBeVisible();

    await userEvent.click(body.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
  },
};

export const SaveFailureStaysInlineAndOpen: Story = {
  name: 'A failed save surfaces inline and keeps the drawer open — no 409 branch exists for lineups',
  args: { mode: { type: 'create' } },
  parameters: {
    msw: { handlers: [http.post('/api/lineups', () => new HttpResponse(null, { status: 500 }))] },
  },
  play: async ({ args }) => {
    const body = within(document.body);
    await userEvent.type(body.getByPlaceholderText('e.g. My five-piece'), 'Anything');
    await userEvent.click(body.getByRole('button', { name: 'Save changes' }));

    await expect(await body.findByText('Could not save this lineup. Please try again.')).toBeVisible();
    await expect(body.getByPlaceholderText('e.g. My five-piece')).toHaveValue('Anything');
    expect(args.onClose).not.toHaveBeenCalled();
  },
};
