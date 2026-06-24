import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import ChecklistSection from './ChecklistSection';
import type { ChecklistItem } from '@/types/api';

function item(overrides: Partial<ChecklistItem> & { label: string }): ChecklistItem {
  return {
    id: overrides.id ?? overrides.label,
    createdAt: '2030-04-01T10:00:00Z',
    updatedAt: '2030-04-01T10:00:00Z',
    bookingId: 'b1',
    key: null,
    completedBy: 'USER',
    state: 'PENDING',
    order: 0,
    dependsOn: [],
    autoCompleteRule: null,
    requiredForStatus: null,
    completedAt: null,
    dueDate: null,
    dueDateRule: null,
    concern: null,
    ...overrides,
  };
}

const pendingItems: ChecklistItem[] = [
  item({ label: 'Send quote', key: 'send_quote', shortcutType: 'send_email', shortcutTemplateType: 'quote', requiredForStatus: 'PROVISIONAL' }),
  item({ label: 'Create contract', key: 'create_contract', shortcutType: 'create_contract', requiredForStatus: 'CONFIRMED' }),
  item({ label: 'Send contract', key: 'send_contract', shortcutType: 'send_email', shortcutTemplateType: 'contract_cover', requiredForStatus: 'CONFIRMED' }),
  item({ label: 'Contract signed', key: 'contract_signed', shortcutType: 'mark_contract_signed', requiredForStatus: 'CONFIRMED' }),
  item({ label: 'Create deposit invoice', key: 'create_deposit_invoice', shortcutType: 'create_deposit_invoice', requiredForStatus: 'CONFIRMED' }),
  item({ label: 'Deposit received', key: 'deposit_received', shortcutType: 'mark_deposit_received', requiredForStatus: 'CONFIRMED' }),
];

const noop = () => {};

const mswHandlers = [
  http.get('/api/bookings/b1', () => HttpResponse.json({ id: 'b1', fee: null, sets: [], packages: [], activeContract: null })),
  http.get('/api/bookings/b1/invoices', () => HttpResponse.json([])),
  // BookingConceptCardContainer (useDismissibleHint) fetches /api/me — mock it so no request leaks.
  http.get('/api/me', () => HttpResponse.json({})),
];

const meta = {
  component: ChecklistSection,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  parameters: { msw: { handlers: mswHandlers } },
  args: {
    bookingId: 'b1',
    isLoading: false,
    bookingStatus: 'CONFIRMED',
    onToggle: noop,
    onAddItem: noop,
    isAddingItem: false,
  },
} satisfies Meta<typeof ChecklistSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { items: [] },
};

export const AllPendingWithShortcuts: Story = {
  args: { items: pendingItems, bookingStatus: 'PROVISIONAL' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Checklist')).toBeVisible();
    await expect(canvas.getByText('Send quote')).toBeVisible();
    await expect(canvas.getAllByText('Send')[0]).toBeVisible();
    await expect(canvas.getAllByText('Create')[0]).toBeVisible();
    await expect(canvas.getAllByText('Mark done')[0]).toBeVisible();
  },
};

export const MixedStates: Story = {
  args: {
    bookingStatus: 'PROVISIONAL',
    items: [
      item({ label: 'Send quote', key: 'send_quote', state: 'COMPLETE', requiredForStatus: 'PROVISIONAL' }),
      item({ label: 'Create contract', key: 'create_contract', state: 'PENDING', requiredForStatus: 'CONFIRMED' }),
      item({ label: 'Send contract', key: 'send_contract', state: 'BLOCKED', requiredForStatus: 'CONFIRMED' }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Send quote')).toBeVisible();
    await expect(canvas.getByText('Create contract')).toBeVisible();
  },
};

export const WithFailedItem: Story = {
  args: {
    bookingStatus: 'PROVISIONAL',
    items: [
      item({ label: 'Send confirmation', key: 'send_quote', state: 'FAILED', shortcutType: 'send_email', shortcutTemplateType: 'quote', requiredForStatus: 'PROVISIONAL' }),
      item({ label: 'Create contract', state: 'PENDING', requiredForStatus: 'CONFIRMED' }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Send confirmation')).toBeVisible();
    await expect(canvas.getByText('Retry')).toBeVisible();
  },
};

export const AllComplete: Story = {
  args: {
    items: [
      item({ label: 'Send quote', state: 'COMPLETE' }),
      item({ label: 'Create contract', state: 'COMPLETE' }),
      item({ label: 'Sign contract', state: 'COMPLETE' }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Send quote')).toBeVisible();
  },
};

export const ShowAllToggle: Story = {
  args: {
    items: [
      item({ label: 'Send quote', requiredForStatus: 'PROVISIONAL' }),
      item({ label: 'Create contract', requiredForStatus: 'CONFIRMED' }),
      item({ label: 'Send contract', requiredForStatus: 'CONFIRMED' }),
      item({ label: 'Create balance invoice', requiredForStatus: 'READY' }),
      item({ label: 'Send thank you', key: 'send_thank_you', requiredForStatus: 'COMPLETE' }),
    ],
    bookingStatus: 'PROVISIONAL',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Show all')).toBeVisible();
    await userEvent.click(canvas.getByText('Show all'));
    await expect(canvas.getByText('Show fewer')).toBeVisible();
    await expect(canvas.getByText('Create balance invoice')).toBeVisible();
  },
};

export const AddItemForm: Story = {
  args: { items: pendingItems },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText('Add item'));
    const body = within(document.body);
    await expect(body.getByPlaceholderText('Item label')).toBeVisible();
  },
};
