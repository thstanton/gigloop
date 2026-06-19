import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CopyPlus, Plus } from 'lucide-react';
import React from 'react';
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

// A labelled primary action plus a "…" overflow menu of secondary actions, each with an
// optional helper line. The menu lists every option, including the primary one.
export const TitleActionAndMenu: Story = {
  args: {
    title: 'Bookings in Series',
    action: (
      <button className="text-xs text-primary hover:text-primary/80 transition-colors">
        Repeat this booking
      </button>
    ),
    menu: [
      {
        label: 'Repeat this booking',
        description: 'Copies everything onto a new date',
        icon: React.createElement(CopyPlus, { size: 16 }),
        onClick: fn(),
      },
      {
        label: 'New booking in series',
        description: 'Same client, different gig',
        icon: React.createElement(Plus, { size: 16 }),
        onClick: fn(),
      },
    ],
    children: <p className="text-sm text-muted">Three other bookings in this series.</p>,
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByLabelText('More actions'));
    const body = within(document.body);
    await expect(await body.findByText('New booking in series')).toBeVisible();
    await expect(body.getByText('Copies everything onto a new date')).toBeVisible();
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
