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
    await userEvent.click(suggestion);
    await expect(args.onAdd).toHaveBeenCalledWith({ title: 'Perfect', artist: 'Ed Sheeran', genre: 'CONTEMPORARY' });
  },
};
