import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { SeriesEventsCard } from './SeriesEventsCard';
import type { BookingListItem } from '@/types/api';

const venue = { id: 'c1', name: 'The Grand Hotel' };
const customer = { id: 'c2', name: 'Sophie Hartley', email: 'sophie@example.com' };
const series = { id: 'sr1', label: 'Grand Hotel Monthly Residency' };

const makeBooking = (overrides: Partial<BookingListItem>): BookingListItem => ({
  id: 'b1',
  createdAt: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
  status: 'CONFIRMED',
  eventType: 'CORPORATE',
  date: '2030-07-15T19:00:00Z',
  title: 'Grand Hotel Summer Ball',
  fee: '1500.00',
  customerId: customer.id,
  customer,
  venueId: venue.id,
  venue,
  bookingAgentId: null,
  bookingAgent: null,
  sets: [],
  seriesId: series.id,
  series,
  ...overrides,
});

const seriesBookings: BookingListItem[] = [
  makeBooking({ id: 'b1', date: '2030-07-15T19:00:00Z', title: 'Grand Hotel Summer Ball' }),
  makeBooking({ id: 'b2', date: '2030-08-19T19:00:00Z', title: 'Grand Hotel August Night' }),
  makeBooking({ id: 'b3', date: '2030-09-16T19:00:00Z', title: null }),
];

const noop = () => {};

const meta = {
  component: SeriesEventsCard,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    bookings: seriesBookings,
    isLoading: false,
    onCopyEvent: noop,
    onAddToSeries: noop,
  },
} satisfies Meta<typeof SeriesEventsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithBookings: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Bookings in Series')).toBeVisible();
    await expect(canvas.getByText('Grand Hotel Summer Ball')).toBeVisible();
    await expect(canvas.getByText('Grand Hotel August Night')).toBeVisible();
    // Primary action is a labelled ghost button (not an icon-only shortcut).
    await expect(canvas.getByText('Repeat this booking')).toBeVisible();
    // The "…" menu lists every action — incl. the shortcut one — each with a helper line.
    await userEvent.click(canvas.getByLabelText('More actions'));
    await expect(await within(document.body).findByText('Copies everything onto a new date')).toBeVisible();
    await userEvent.click(await within(document.body).findByText('New booking in series'));
  },
};

export const Loading: Story = {
  args: { bookings: [], isLoading: true },
};

export const Empty: Story = {
  args: { bookings: [], isLoading: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No other bookings in this series yet.')).toBeVisible();
    await expect(canvas.getByText('Repeat this booking')).toBeVisible();
    await userEvent.click(canvas.getByLabelText('More actions'));
    await expect(await within(document.body).findByText('New booking in series')).toBeVisible();
  },
};
