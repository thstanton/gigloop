import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import BookingsTable from './BookingsTable';
import type { BookingListItem } from '@/types/api';

const bookings: BookingListItem[] = [
  {
    id: 'b1',
    createdAt: '2024-04-01T10:00:00Z',
    updatedAt: '2024-04-01T10:00:00Z',
    status: 'CONFIRMED',
    eventType: 'CORPORATE',
    date: '2030-07-15T19:00:00Z',
    title: 'Grand Hotel Summer Ball',
    fee: '1500.00',
    customerId: 'c1',
    customer: { id: 'c1', name: 'The Grand Hotel', email: 'events@grandhotel.com' },
    venueId: 'c1',
    venue: { id: 'c1', name: 'The Grand Hotel', email: null },
    bookingAgentId: null,
    bookingAgent: null,
    sets: [{ startTime: '19:00' }],
    seriesId: 's1',
    series: { id: 's1', label: 'Grand Hotel Residency — Summer 2030' },
  },
  {
    id: 'b2',
    createdAt: '2024-04-05T11:00:00Z',
    updatedAt: '2024-04-05T11:00:00Z',
    status: 'PROVISIONAL',
    eventType: 'PRIVATE',
    date: '2030-06-22T18:00:00Z',
    title: "Sophie's Birthday Party",
    fee: '800.00',
    customerId: 'c2',
    customer: { id: 'c2', name: 'Sophie Hartley', email: 'sophie@example.com' },
    venueId: null,
    venue: null,
    bookingAgentId: null,
    bookingAgent: null,
    sets: [],
    seriesId: null,
    series: null,
  },
  {
    id: 'b3',
    createdAt: '2024-04-08T09:00:00Z',
    updatedAt: '2024-04-08T09:00:00Z',
    status: 'ENQUIRY',
    eventType: 'CORPORATE',
    date: '2030-05-10T19:30:00Z',
    title: 'Corporate Awards Dinner',
    fee: '2000.00',
    customerId: 'c3',
    customer: { id: 'c3', name: 'Premier Events Agency', email: null },
    venueId: null,
    venue: null,
    bookingAgentId: null,
    bookingAgent: null,
    sets: [{ startTime: '19:30' }],
    seriesId: null,
    series: null,
  },
];

const meta = {
  component: BookingsTable,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof BookingsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithData: Story = {
  args: { data: bookings },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('Grand Hotel Summer Ball')[0]).toBeVisible();
    await expect(canvas.getAllByText('Confirmed')[0]).toBeVisible();
  },
};

export const Empty: Story = {
  args: { data: [] },
};

export const NoResults: Story = {
  args: { data: [], searchQuery: 'smith wedding', onClearSearch: () => {} },
};

export const WithNewCallback: Story = {
  args: { data: bookings, onNew: () => {} },
};
