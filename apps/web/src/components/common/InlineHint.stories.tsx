import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
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

/** Action as an operation: `onClick` renders a button instead of a link, for hints whose action mutates rather than navigates. */
export const ActionButton: Story = {
  args: {
    href: undefined,
    onClick: fn(),
    actionLabel: 'Create the contract',
    children: "There's no contract yet.",
  },
  play: async ({ canvas, args }) => {
    const button = canvas.getByRole('button', { name: /create the contract/i });
    await expect(button).toBeVisible();
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

/** With `onDismiss`, a trailing "X" lets the musician clear the hint (persistence is the caller's job). */
export const Dismissible: Story = {
  args: {
    children: 'Due dates are set from the gig date.',
    actionLabel: 'Adjust in Settings',
    onDismiss: fn(),
  },
  play: async ({ canvas, args }) => {
    const dismiss = canvas.getByRole('button', { name: /dismiss/i });
    await expect(dismiss).toBeVisible();
    await userEvent.click(dismiss);
    await expect(args.onDismiss).toHaveBeenCalledOnce();
  },
};
