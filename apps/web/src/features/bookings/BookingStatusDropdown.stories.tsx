import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import BookingStatusDropdown from './BookingStatusDropdown';
import type { ChecklistItem } from '@/types/api';

function item(overrides: Partial<ChecklistItem> & { label: string }): ChecklistItem {
  return {
    id: overrides.label,
    createdAt: '2030-04-01T10:00:00Z',
    updatedAt: '2030-04-01T10:00:00Z',
    bookingId: 'b1',
    key: null,
    completedBy: 'USER',
    state: 'PENDING',
    order: 0,
    autoCompleteRule: null,
    requiredForStatus: null,
    completedAt: null,
    dueDate: null,
    dueDateRule: null,
    concern: null,
    ...overrides,
  };
}

const outstandingItems: ChecklistItem[] = [
  item({ label: 'Sign contract', state: 'PENDING', requiredForStatus: 'CONFIRMED' }),
  item({ label: 'Deposit received', state: 'PENDING', requiredForStatus: 'CONFIRMED' }),
];

const meta = {
  component: BookingStatusDropdown,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    checklist: [],
    onStatusChange: () => {},
    isPending: false,
  },
} satisfies Meta<typeof BookingStatusDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enquiry: Story = {
  args: { currentStatus: 'ENQUIRY' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Enquiry')).toBeVisible();
  },
};

export const Confirmed: Story = {
  args: { currentStatus: 'CONFIRMED' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Confirmed')).toBeVisible();
  },
};

export const Ready: Story = {
  args: { currentStatus: 'READY' },
};

export const Complete: Story = {
  args: { currentStatus: 'COMPLETE' },
};

export const Cancelled: Story = {
  args: { currentStatus: 'CANCELLED' },
};

export const Pending: Story = {
  args: { currentStatus: 'CONFIRMED', isPending: true },
};

export const OutstandingChecklistDialog: Story = {
  args: { currentStatus: 'PROVISIONAL', checklist: outstandingItems },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText('Provisional'));
    const body = within(document.body);
    const confirmItem = body.getByText('Confirmed');
    await userEvent.click(confirmItem);
    await expect(body.getByText('Outstanding checklist items')).toBeVisible();
    await expect(body.getByText('Sign contract')).toBeVisible();
  },
};
