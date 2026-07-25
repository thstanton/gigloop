import { SearchService, compareBookingRows, compareContactRows, TOP_N_PER_TYPE } from './search.service';
import { SearchRepository, BookingSearchRow, ContactSearchRow } from './search.repository';

function booking(overrides: Partial<BookingSearchRow>): BookingSearchRow {
  return {
    id: 'b1',
    title: null,
    date: new Date('2026-08-01'),
    status: 'CONFIRMED',
    eventType: 'WEDDING',
    customer: { name: 'Smith' },
    venue: null,
    ...overrides,
  } as BookingSearchRow;
}

function contact(overrides: Partial<ContactSearchRow>): ContactSearchRow {
  return {
    id: 'c1',
    name: 'Smith',
    email: null,
    phone: null,
    _count: { customerBookings: 0, venueBookings: 0, bookingAgentBookings: 0 },
    ...overrides,
  } as ContactSearchRow;
}

describe('compareBookingRows', () => {
  const now = new Date('2026-07-25T00:00:00Z');

  it('sinks CANCELLED below every non-cancelled booking regardless of date', () => {
    const cancelled = booking({ id: 'cancelled', status: 'CANCELLED', date: new Date('2099-01-01') });
    const confirmed = booking({ id: 'confirmed', status: 'CONFIRMED', date: new Date('2020-01-01') });
    expect(compareBookingRows(cancelled, confirmed, now)).toBeGreaterThan(0);
    expect(compareBookingRows(confirmed, cancelled, now)).toBeLessThan(0);
  });

  it('sorts upcoming bookings soonest-first', () => {
    const soon = booking({ id: 'soon', date: new Date('2026-08-01') });
    const later = booking({ id: 'later', date: new Date('2026-09-01') });
    expect(compareBookingRows(soon, later, now)).toBeLessThan(0);
  });

  it('sorts past bookings most-recent-first', () => {
    const recentPast = booking({ id: 'recent', date: new Date('2026-07-01') });
    const olderPast = booking({ id: 'older', date: new Date('2026-01-01') });
    expect(compareBookingRows(recentPast, olderPast, now)).toBeLessThan(0);
  });

  it('places every upcoming booking ahead of every past booking', () => {
    const upcoming = booking({ id: 'upcoming', date: new Date('2026-08-01') });
    const past = booking({ id: 'past', date: new Date('2020-01-01') });
    expect(compareBookingRows(upcoming, past, now)).toBeLessThan(0);
  });
});

describe('compareContactRows', () => {
  it('orders by total booking count across all three roles, descending', () => {
    const busy = contact({
      id: 'busy',
      _count: { customerBookings: 3, venueBookings: 1, bookingAgentBookings: 0 },
    });
    const quiet = contact({
      id: 'quiet',
      _count: { customerBookings: 1, venueBookings: 0, bookingAgentBookings: 0 },
    });
    expect(compareContactRows(busy, quiet)).toBeLessThan(0);
    expect(compareContactRows(quiet, busy)).toBeGreaterThan(0);
  });
});

describe('SearchService', () => {
  function makeService(bookingRows: BookingSearchRow[], contactRows: ContactSearchRow[]) {
    const repo = {
      searchBookings: jest.fn().mockResolvedValue(bookingRows),
      searchContacts: jest.fn().mockResolvedValue(contactRows),
    } as unknown as SearchRepository;
    return new SearchService(repo);
  }

  it('groups results by type — all bookings before any contact', async () => {
    const service = makeService([booking({ id: 'b1' })], [contact({ id: 'c1' })]);
    const results = await service.search('u1', 'smith');
    expect(results.map((r) => r.type)).toEqual(['booking', 'contact']);
  });

  it('caps each type at TOP_N_PER_TYPE', async () => {
    const bookingRows = Array.from({ length: TOP_N_PER_TYPE + 3 }, (_, i) =>
      booking({ id: `b${i}`, date: new Date(2026, 7, i + 1) }),
    );
    const contactRows = Array.from({ length: TOP_N_PER_TYPE + 3 }, (_, i) => contact({ id: `c${i}` }));
    const service = makeService(bookingRows, contactRows);
    const results = await service.search('u1', 'smith');
    expect(results.filter((r) => r.type === 'booking')).toHaveLength(TOP_N_PER_TYPE);
    expect(results.filter((r) => r.type === 'contact')).toHaveLength(TOP_N_PER_TYPE);
  });

  it('maps a booking row to a result with url, title fallback, and subtitle', async () => {
    const service = makeService(
      [
        booking({
          id: 'b1',
          title: null,
          customer: { name: 'Jane Smith' },
          venue: { name: 'The Barn' },
          status: 'CONFIRMED',
          eventType: 'WEDDING',
          date: new Date('2026-08-01T00:00:00Z'),
        }),
      ],
      [],
    );
    const results = await service.search('u1', 'smith');
    expect(results[0]).toEqual({
      type: 'booking',
      id: 'b1',
      url: '/admin/bookings/b1',
      title: 'Jane Smith',
      subtitle: 'The Barn',
      status: 'CONFIRMED',
      date: new Date('2026-08-01T00:00:00Z').toISOString(),
      eventType: 'WEDDING',
    });
  });

  it('prefers the booking title over the customer-name fallback when set', async () => {
    const service = makeService(
      [booking({ id: 'b1', title: 'Summer Wedding', customer: { name: 'Jane Smith' } })],
      [],
    );
    const results = await service.search('u1', 'smith');
    expect(results[0].title).toBe('Summer Wedding');
  });

  it('maps a contact row to a result with url, title, subtitle, and summed bookingCount', async () => {
    const service = makeService(
      [],
      [
        contact({
          id: 'c1',
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '01234',
          _count: { customerBookings: 2, venueBookings: 1, bookingAgentBookings: 1 },
        }),
      ],
    );
    const results = await service.search('u1', 'smith');
    expect(results[0]).toEqual({
      type: 'contact',
      id: 'c1',
      url: '/admin/contacts/c1',
      title: 'Jane Smith',
      subtitle: 'jane@example.com',
      bookingCount: 4,
    });
  });

  it('falls back to phone for contact subtitle when email is absent', async () => {
    const service = makeService([], [contact({ id: 'c1', email: null, phone: '01234' })]);
    const results = await service.search('u1', 'smith');
    expect(results[0].subtitle).toBe('01234');
  });

  it('passes userId and q straight through to the repository', async () => {
    const repo = {
      searchBookings: jest.fn().mockResolvedValue([]),
      searchContacts: jest.fn().mockResolvedValue([]),
    } as unknown as SearchRepository;
    const service = new SearchService(repo);
    await service.search('u1', 'smith');
    expect(repo.searchBookings).toHaveBeenCalledWith('u1', 'smith');
    expect(repo.searchContacts).toHaveBeenCalledWith('u1', 'smith');
  });
});
