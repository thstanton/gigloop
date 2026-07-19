import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { AddSongField } from './AddSongField';
import type { CatalogueEntry } from '@/types/api';

const catalogue: CatalogueEntry[] = [
  { id: '1', title: 'Perfect', artist: 'Ed Sheeran', genre: 'CONTEMPORARY' },
  { id: '2', title: 'Thinking Out Loud', artist: 'Ed Sheeran', genre: 'CONTEMPORARY' },
  { id: '3', title: 'Fly Me to the Moon', artist: 'Frank Sinatra', genre: 'JAZZ' },
];

const meta = {
  component: AddSongField,
  tags: ['ai-generated'],
  args: { catalogue, onAdd: fn() },
} satisfies Meta<typeof AddSongField>;

export default meta;
type Story = StoryObj<typeof meta>;

// Smoke — the search input and the manual-entry disclosure render.
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox', { name: 'Search the catalogue' })).toBeVisible();
    await expect(canvas.getByText(/enter it manually/i)).toBeVisible();
  },
};

// Primary happy path — search the catalogue, pick a suggestion, and it's emitted with
// artist + genre filled from the catalogue entry.
export const AddFromCatalogue: Story = {
  play: async ({ canvas, args }) => {
    const input = canvas.getByRole('combobox', { name: 'Search the catalogue' });
    await userEvent.type(input, 'perf');
    const suggestion = await canvas.findByText('Perfect');
    await expect(suggestion).toBeVisible();
    await expect(canvas.queryByText(/no matches/i)).not.toBeInTheDocument();
    await userEvent.click(suggestion);
    await expect(args.onAdd).toHaveBeenCalledWith({ title: 'Perfect', artist: 'Ed Sheeran', genre: 'CONTEMPORARY' });
  },
};

// #701 — a query that matches nothing must say so, and its action opens manual entry. Previously
// the field rendered nothing at all, so users concluded their typing hadn't registered.
export const NoMatches: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByRole('combobox', { name: 'Search the catalogue' });
    await userEvent.type(input, 'My Girl');
    await expect(await canvas.findByText(/no matches for/i)).toBeVisible();
    await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Add it manually' }));
    await expect(await canvas.findByLabelText('Title')).toBeVisible();
    await expect(canvas.getByLabelText('Artist (optional)')).toBeVisible();
  },
};

// A blank / whitespace-only query is not a no-match — neither panel appears.
export const EmptyQuery: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByRole('combobox', { name: 'Search the catalogue' });
    await userEvent.type(input, '   ');
    await expect(canvas.queryByText(/no matches/i)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('listbox')).not.toBeInTheDocument();
  },
};

// While the host's catalogue query is still pending the catalogue is `[]` for a reason that isn't
// "no match" — the field must never assert a false negative before the data lands.
export const CatalogueLoading: Story = {
  args: { catalogue: [], catalogueLoading: true },
  play: async ({ canvas }) => {
    const input = canvas.getByRole('combobox', { name: 'Search the catalogue' });
    await userEvent.type(input, 'My Girl');
    await expect(await canvas.findByText(/searching the catalogue/i)).toBeVisible();
    await expect(canvas.queryByText(/no matches/i)).not.toBeInTheDocument();
  },
};
