import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Common/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const NoTitle: Story = {
  args: {
    children: <p className="text-sm text-foreground">Card content with no title or action.</p>,
  },
};

export const TitleOnly: Story = {
  args: {
    title: 'Section heading',
    children: <p className="text-sm text-foreground">Card with a title but no action button.</p>,
  },
};

export const TitleAndAction: Story = {
  args: {
    title: 'Invoices',
    action: (
      <button className="text-xs text-primary hover:text-primary/80 transition-colors">
        + Add invoice
      </button>
    ),
    children: <p className="text-sm text-muted">No invoices yet.</p>,
  },
};

export const RealisticContent: Story = {
  args: {
    title: 'Booking notes',
    children: (
      <div className="space-y-2">
        <p className="text-sm text-foreground">
          Client requested classical repertoire for the ceremony. Arrival 1 hour before start.
        </p>
        <p className="text-sm text-muted">Last updated 2 days ago</p>
      </div>
    ),
  },
};
