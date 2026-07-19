import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
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
    autoCompleteRule: null,
    requiredForStatus: null,
    completedAt: null,
    dueDate: null,
    dueDateRule: null,
    concern: null,
    ...overrides,
  };
}

const noop = () => {};

const mswHandlers = [
  http.get('/api/bookings/b1', () => HttpResponse.json({ id: 'b1', fee: null, sets: [], packages: [], activeContract: null })),
  http.get('/api/bookings/b1/invoices', () => HttpResponse.json([])),
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
  play: async ({ canvas }) => {
    // No goals — the always-present "Anytime" section still offers a place to add one.
    await expect(canvas.getByText('Anytime')).toBeVisible();
    await expect(canvas.getAllByText('Add item').length).toBeGreaterThan(0);
  },
};

// The current lifecycle bracket is open and foreground-weighted; each goal shows its next action.
// A CONFIRMED booking's open bracket is "Confirmed" — the READY-gated work to advance from here.
export const CurrentStageOpen: Story = {
  args: {
    bookingStatus: 'CONFIRMED',
    items: [
      item({ label: 'Add venue', key: 'add_venue', requiredForStatus: 'READY' }),
      item({ label: 'Bring spare strings', key: null, requiredForStatus: 'READY' }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Confirmed')).toBeVisible();
    await expect(canvas.getByText('0/2')).toBeVisible();
    // Structural goal → wand "Set up"; a custom goal with no shortcut → "Mark complete".
    await expect(canvas.getByText('Add venue')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Set up' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Mark complete' })).toBeVisible();
    // #698: no goal carries a due date here, so the derivation hint stays out of the way.
    await expect(canvas.queryByText(/Due dates are set from the gig date/)).toBeNull();
  },
};

// #698: when any goal has a due date, one persistent line explains where the dates come from and
// links to the Settings configurator that governs the rule.
export const WithDueDates: Story = {
  args: {
    bookingStatus: 'CONFIRMED',
    items: [
      item({ label: 'Get the contract signed', requiredForStatus: 'READY', dueDate: '2030-07-20T00:00:00Z', dueDateRule: { basis: 'bookingDate', offsetDays: -60 } }),
      item({ label: 'Bring spare strings', requiredForStatus: 'READY' }),
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Due dates are set from the gig date/)).toBeVisible();
    const link = canvas.getByRole('link', { name: /Adjust in Settings/ });
    await expect(link).toHaveAttribute('href', '/admin/settings');
    // Exactly one hint for the whole checklist — not one per dated goal.
    await expect(canvas.getAllByText(/Due dates are set from the gig date/)).toHaveLength(1);
  },
};

// A left-behind goal sits in its collapsed past bracket — visible (not vanished) and reachable by
// expanding it. This answers "where did the deposit reminder go?" (#604 acceptance test). The
// CONFIRMED-gated quote is worked in the Provisional bracket — past for a CONFIRMED booking.
export const PastStageCollapsed: Story = {
  args: {
    bookingStatus: 'CONFIRMED',
    items: [
      item({ label: 'Send quote', key: 'send_quote', shortcutType: 'send_email', shortcutTemplateType: 'quote', requiredForStatus: 'CONFIRMED' }),
      item({ label: 'Add venue', key: 'add_venue', requiredForStatus: 'READY' }),
    ],
  },
  play: async ({ canvas }) => {
    // Past bracket present (header + count) but collapsed — its goal isn't shown yet.
    await expect(canvas.getByText('Provisional')).toBeVisible();
    await expect(canvas.queryByText('Send quote')).toBeNull();
    // Expanding the past bracket reveals the left-behind goal.
    await userEvent.click(canvas.getByText('Provisional'));
    await expect(canvas.getByText('Send quote')).toBeVisible();
  },
};

export const WithFailedItem: Story = {
  args: {
    bookingStatus: 'CONFIRMED',
    items: [
      item({ label: 'Send confirmation', key: 'send_quote', state: 'FAILED', shortcutType: 'send_email', shortcutTemplateType: 'quote', requiredForStatus: 'READY' }),
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
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Send quote')).toBeVisible();
    // Two complete, none skipped → the Anytime section reads 2/2.
    await expect(canvas.getByText('2/2')).toBeVisible();
  },
};

export const AddItemInSection: Story = {
  args: {
    bookingStatus: 'CONFIRMED',
    items: [item({ label: 'Add venue', key: 'add_venue', requiredForStatus: 'READY' })],
  },
  play: async ({ canvas }) => {
    // Each open section has its own "Add item" affordance; clicking reveals the inline form.
    await userEvent.click(canvas.getAllByText('Add item')[0]);
    await expect(canvas.getByPlaceholderText('Item label')).toBeVisible();
  },
};

// A multi-step goal (ADR-0057 / #611) renders as the two-tier GoalRow inside the section: the
// goal label plus its active step. Atomic goals around it keep the single-line row.
const contractGoal: ChecklistItem = item({
  label: 'Get the contract signed',
  key: 'get_contract_signed',
  requiredForStatus: 'CONFIRMED',
  steps: [
    { id: 's1', key: 'create_contract', label: 'Draft the contract', order: 1, kind: 'MILESTONE', completeMode: 'ACTION', state: 'COMPLETE', completedBy: 'USER', completedAt: null, autoCompleteRule: null },
    { id: 's2', key: 'send_contract', label: 'Send it to the client', order: 2, kind: 'MILESTONE', completeMode: 'ACTION', state: 'PENDING', completedBy: 'USER', completedAt: null, autoCompleteRule: null, shortcutType: 'send_email', shortcutTemplateType: 'contract_cover' },
    { id: 's3', key: 'contract_signed', label: 'Client signs the contract', order: 3, kind: 'MILESTONE', completeMode: 'AWAITED', state: 'PENDING', completedBy: 'CUSTOMER', completedAt: null, autoCompleteRule: null },
  ],
});

export const WithMultiStepGoal: Story = {
  args: {
    // Booking PROVISIONAL → the CONFIRMED-gated contract sits in the open "Provisional" bracket.
    bookingStatus: 'PROVISIONAL',
    items: [contractGoal, item({ label: 'Add venue', key: 'add_venue', requiredForStatus: 'CONFIRMED' })],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Get the contract signed')).toBeVisible();
    // The active step is shown as a CTA; the atomic goal keeps its single-line row alongside it.
    await expect(canvas.getByRole('button', { name: /Send it to the client/ })).toBeVisible();
    await expect(canvas.getByText('Add venue')).toBeVisible();
  },
};
