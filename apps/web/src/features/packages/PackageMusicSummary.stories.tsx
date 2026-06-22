import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { PackageMusicSummary } from './PackageMusicSummary';

// Feature presentational component (ADR-0024): smoke + one interaction play covering the happy path,
// plus an empty-state story asserting it renders nothing.
const meta = {
  component: PackageMusicSummary,
  tags: ['ai-generated'],
} satisfies Meta<typeof PackageMusicSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

// Genres map through GENRE_LABELS to their display names; special requests list verbatim.
export const GenresAndMoments: Story = {
  args: {
    genres: ['JAZZ', 'CONTEMPORARY'],
    moments: ['First dance', 'Cake cutting'],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Sets up the music form with:')).toBeVisible();
    await expect(canvas.getByText('Jazz')).toBeVisible();
    await expect(canvas.getByText('Contemporary')).toBeVisible();
    await expect(canvas.getByText('First dance')).toBeVisible();
    await expect(canvas.getByText('Cake cutting')).toBeVisible();
  },
};

// Only genres seeded — the special-requests section is absent.
export const GenresOnly: Story = {
  args: { genres: ['CLASSICAL'], moments: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Classical')).toBeVisible();
    await expect(canvas.queryByText(/Special-request moments/i)).toBeNull();
  },
};

// Seeds neither → renders nothing at all.
export const Empty: Story = {
  args: { genres: [], moments: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('Sets up the music form with:')).toBeNull();
  },
};
