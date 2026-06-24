import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { Home } from 'lucide-react';
import { InlineHint } from './InlineHint';

const meta = {
  title: 'Common/InlineHint',
  component: InlineHint,
  tags: ['autodocs'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    actionLabel: 'Add your home address to see travel time',
    href: '/admin/settings',
  },
} satisfies Meta<typeof InlineHint>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Primary use case: an action link routing to where the gap is fixed, led by the default sparkle marker. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: /add your home address/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/admin/settings');
  },
};

/** With muted lead text ahead of the action. */
export const WithLeadText: Story = {
  args: {
    children: 'Travel times need your base location.',
  },
};

/** The default sparkle can be overridden with another Lucide icon. */
export const CustomIcon: Story = {
  args: {
    icon: React.createElement(Home, { size: 14 }),
  },
};
