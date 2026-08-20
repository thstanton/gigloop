import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { LineupList } from './LineupList';
import { lineupTemplate } from '@/test/factories';

// Band members v1 (#879, ADR-0072 §3). Page-adjacent presentational component: smoke covering
// both the populated grid and the empty state (ADR-0024).
const meta = {
  component: LineupList,
  tags: ['ai-generated'],
  args: { onEdit: fn(), onCreate: fn() },
} satisfies Meta<typeof LineupList>;

export default meta;
type Story = StoryObj<typeof meta>;

const fivePiece = lineupTemplate({
  id: 'l1',
  label: 'My five-piece',
  slots: [
    { id: 's1', role: 'Saxophone', order: 0 },
    { id: 's2', role: 'Drums', order: 1 },
  ],
});

export const Populated: Story = {
  args: { lineups: [fivePiece] },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('My five-piece')).toBeVisible();
    await expect(canvas.getByText('Saxophone')).toBeVisible();
    await expect(canvas.getByText('Drums')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'Edit' }));
    await expect(args.onEdit).toHaveBeenCalledWith(fivePiece);
  },
};

export const Empty: Story = {
  args: { lineups: [] },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('No lineups yet')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'New lineup' }));
    await expect(args.onCreate).toHaveBeenCalled();
  },
};
