import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { updateBookingInListCaches } from './useBookings';
import type { BookingDetail, BookingListItem } from '@/types/api';

function listRow(overrides: Partial<BookingListItem> & Pick<BookingListItem, 'id'>): BookingListItem {
  return {
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    status: 'ENQUIRY',
    eventType: 'WEDDING',
    date: '2026-06-01T00:00:00.000Z',
    title: null,
    fee: null,
    customerId: 'c1',
    customer: { id: 'c1', name: 'Old Customer', email: null },
    venueId: null,
    venue: null,
    bookingAgentId: null,
    bookingAgent: null,
    sets: [],
    seriesId: null,
    series: null,
    ...overrides,
  };
}

// A full booking as the PATCH endpoints return it: every relation hydrated, plus fields that
// must NOT survive the projection to the lean list row (notes, logistics, packages).
const fullBooking = {
  id: 'b1',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-02-02T00:00:00.000Z',
  status: 'CONFIRMED',
  eventType: 'WEDDING',
  date: '2026-06-01T00:00:00.000Z',
  title: 'Updated title',
  fee: '1500.00',
  customerId: 'c1',
  customer: { id: 'c1', name: 'New Customer', email: 'new@example.com', notes: 'private' },
  venueId: 'v1',
  venue: { id: 'v1', name: 'The Venue', email: 'v@example.com' },
  bookingAgentId: null,
  bookingAgent: null,
  sets: [{ startTime: '19:00' }, { startTime: '21:00' }],
  seriesId: null,
  series: null,
  notes: 'should be dropped',
  logistics: { foo: 'bar' },
  packages: [{ id: 'p1' }],
} as unknown as BookingDetail;

describe('updateBookingInListCaches', () => {
  it('splices the lean row into every cached list permutation that holds it', () => {
    const client = new QueryClient();
    const keyA = ['bookings', [], '', '', '', ''];
    const keyB = ['bookings', ['CONFIRMED'], 'wedding', '', '', ''];
    client.setQueryData<BookingListItem[]>(keyA, [listRow({ id: 'b1' }), listRow({ id: 'b2' })]);
    client.setQueryData<BookingListItem[]>(keyB, [listRow({ id: 'b1' })]);

    updateBookingInListCaches(client, fullBooking);

    const a = client.getQueryData<BookingListItem[]>(keyA)!;
    const b = client.getQueryData<BookingListItem[]>(keyB)!;
    expect(a.find((r) => r.id === 'b1')).toMatchObject({ title: 'Updated title', fee: '1500.00', status: 'CONFIRMED' });
    expect(a.find((r) => r.id === 'b2')!.customer.name).toBe('Old Customer'); // untouched
    expect(b[0]).toMatchObject({ title: 'Updated title' });
  });

  it('projects the booking down to the lean shape, dropping non-list fields', () => {
    const client = new QueryClient();
    const key = ['bookings', [], '', '', '', ''];
    client.setQueryData<BookingListItem[]>(key, [listRow({ id: 'b1' })]);

    updateBookingInListCaches(client, fullBooking);

    const row = client.getQueryData<BookingListItem[]>(key)![0];
    expect(row).not.toHaveProperty('notes');
    expect(row).not.toHaveProperty('logistics');
    expect(row).not.toHaveProperty('packages');
    // venue/customer are projected to the lean summary (id + name [+ email]); sets keep only the first.
    expect(row.venue).toEqual({ id: 'v1', name: 'The Venue' });
    expect(row.customer).toEqual({ id: 'c1', name: 'New Customer', email: 'new@example.com' });
    expect(row.sets).toEqual([{ startTime: '19:00' }]);
  });

  it('leaves caches that do not contain the booking unchanged', () => {
    const client = new QueryClient();
    const key = ['bookings', [], '', '', '', ''];
    const others = [listRow({ id: 'b2' }), listRow({ id: 'b3' })];
    client.setQueryData<BookingListItem[]>(key, others);

    updateBookingInListCaches(client, fullBooking);

    expect(client.getQueryData<BookingListItem[]>(key)).toEqual(others);
  });
});
