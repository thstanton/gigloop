import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { StageCard } from './StageCard';

const meta = {
  component: StageCard,
  tags: ['ai-generated'],
} satisfies Meta<typeof StageCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// A real lifecycle stage — coloured accent bar + description, with row content as children.
export const Stage: Story = {
  args: {
    label: 'Provisional',
    description: 'The client has agreed your quote in principle.',
    accentClass: 'bg-status-provisional',
    children: (
      <div className="divide-y divide-border">
        <p className="px-4 py-3 text-base text-foreground">Get the deposit paid</p>
        <p className="px-4 py-3 text-base text-foreground">Get the contract signed</p>
      </div>
    ),
  },
  play: async ({ canvas }) => {
    // Header renders the label and description; the children rows show through the shell.
    await expect(await canvas.findByText('Provisional ·')).toBeVisible();
    await expect(await canvas.findByText(/agreed your quote/)).toBeVisible();
    await expect(await canvas.findByText('Get the deposit paid')).toBeVisible();
  },
};

// A non-stage group (e.g. #620's "Anytime") — no accent colour, neutral bar.
export const NonStageGroup: Story = {
  args: {
    label: 'Anytime',
    description: 'Your own reminders, not tied to a stage.',
    children: <p className="px-4 py-3 text-sm text-muted">Nothing here yet.</p>,
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Anytime ·')).toBeVisible();
    await expect(await canvas.findByText('Nothing here yet.')).toBeVisible();
  },
};
