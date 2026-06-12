import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Edit2, Trash2 } from 'lucide-react';
import { RowActions } from './RowActions';

const meta = {
  title: 'Common/RowActions',
  component: RowActions,
  tags: ['autodocs'],
  args: {
    actions: [
      {
        label: 'Edit',
        icon: React.createElement(Edit2, { size: 14 }),
        onClick: fn(),
      },
      {
        label: 'Delete',
        icon: React.createElement(Trash2, { size: 14 }),
        onClick: fn(),
        variant: 'destructive' as const,
        confirmation: {
          title: 'Delete this item?',
          description: 'This action cannot be undone.',
        },
      },
    ],
  },
} satisfies Meta<typeof RowActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Smoke: Story = {};

export const MobileSheetFlow: Story = {
  args: {
    actions: [
      {
        label: 'Edit',
        icon: React.createElement(Edit2, { size: 14 }),
        onClick: fn(),
      },
      {
        label: 'Delete',
        icon: React.createElement(Trash2, { size: 14 }),
        onClick: fn(),
        variant: 'destructive' as const,
        confirmation: {
          title: 'Delete this item?',
          description: 'This action cannot be undone.',
        },
      },
    ],
  },
  play: async ({ canvas, args }) => {
    // Open sheet via mobile trigger
    const trigger = await canvas.findByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);

    // Sheet renders in a Radix portal — query from document.body
    const body = within(document.body);

    // Both actions visible in sheet
    await expect(body.findByRole('button', { name: /^Edit$/ })).resolves.toBeVisible();
    const deleteBtn = await body.findByRole('button', { name: /^Delete$/ });
    await expect(deleteBtn).toBeVisible();

    // Destructive action replaces sheet body with inline confirmation
    await userEvent.click(deleteBtn);
    await expect(body.findByText('Delete this item?')).resolves.toBeVisible();

    // Confirm fires onClick and closes sheet
    const confirmBtn = await body.findByRole('button', { name: 'Confirm' });
    await userEvent.click(confirmBtn);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any — spy cast: Storybook wraps fn() args as vitest spies at runtime
    expect(args.actions[1].onClick as any).toHaveBeenCalledOnce();
  },
};
