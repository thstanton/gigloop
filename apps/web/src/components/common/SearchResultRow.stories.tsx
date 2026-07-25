import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import type { BookingSearchResult, ContactSearchResult } from '@/types/api';
import { SearchResultRow } from './SearchResultRow';

const booking: BookingSearchResult = {
  type: 'booking',
  id: 'b1',
  url: '/admin/bookings/b1',
  title: 'Hartley Wedding',
  subtitle: 'The Old Barn',
  status: 'CONFIRMED',
  date: '2026-08-15T18:00:00.000Z',
  eventType: 'WEDDING',
};

const cancelledBooking: BookingSearchResult = {
  ...booking,
  id: 'b2',
  url: '/admin/bookings/b2',
  title: 'Corporate Summer Party',
  subtitle: null,
  status: 'CANCELLED',
  eventType: 'CORPORATE',
};

const contact: ContactSearchResult = {
  type: 'contact',
  id: 'c1',
  url: '/admin/contacts/c1',
  title: 'Jane Hartley',
  subtitle: 'jane@example.com',
  bookingCount: 12,
};

const newContact: ContactSearchResult = {
  ...contact,
  id: 'c2',
  url: '/admin/contacts/c2',
  title: 'Tom Reed',
  subtitle: '07700 900123',
  bookingCount: 1,
};

const meta = {
  title: 'Common/SearchResultRow',
  component: SearchResultRow,
  tags: ['autodocs'],
  args: { onSelect: fn() },
} satisfies Meta<typeof SearchResultRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Primary variant: a booking row — date · venue subtitle and a status pill — that reports its
 *  result to the caller on activation without navigating itself. */
export const Booking: Story = {
  args: { result: booking },
  play: async ({ canvas, args }) => {
    const row = canvas.getByRole('button', { name: /hartley wedding/i });
    await expect(row).toBeVisible();
    await userEvent.click(row);
    await expect(args.onSelect).toHaveBeenCalledWith(booking);
  },
};

/** A cancelled booking still surfaces (the palette finds everything); the pill reads its state. */
export const CancelledBooking: Story = {
  args: { result: cancelledBooking },
};

/** A contact row — name, email/phone, and the booking count (pluralised) trailing. */
export const Contact: Story = {
  args: { result: contact },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('12 bookings')).toBeVisible();
  },
};

/** Booking count is singular at one — "1 booking", not "1 bookings". */
export const ContactSingleBooking: Story = {
  args: { result: newContact },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('1 booking')).toBeVisible();
  },
};

/** Without `onSelect` the row is inert content — the shape an Ask-mode answer card reuses (§8). */
export const AsInertCard: Story = {
  args: { result: booking, onSelect: undefined },
};
