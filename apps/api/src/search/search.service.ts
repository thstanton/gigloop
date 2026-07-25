import { Injectable } from '@nestjs/common';
import { SearchRepository, BookingSearchRow, ContactSearchRow } from './search.repository';
import type { SearchResultDto } from './dto/search-result.dto';

// ADR-0067 §5: "the palette shows a handful per type" — a concrete number was needed and 5 is
// the chosen cap (documented here since the ADR left the exact figure to the build). Revisit if
// UAT shows musicians wanting to scroll past the top hits rather than following "see all".
export const TOP_N_PER_TYPE = 5;

function bookingUrl(id: string): string {
  return `/admin/bookings/${id}`;
}

function contactUrl(id: string): string {
  return `/admin/contacts/${id}`;
}

function toBookingResult(row: BookingSearchRow): SearchResultDto {
  return {
    type: 'booking',
    id: row.id,
    url: bookingUrl(row.id),
    title: row.title ?? row.customer.name,
    subtitle: row.venue?.name ?? null,
    status: row.status,
    date: row.date.toISOString(),
    eventType: row.eventType,
  };
}

function toContactResult(row: ContactSearchRow): SearchResultDto {
  return {
    type: 'contact',
    id: row.id,
    url: contactUrl(row.id),
    title: row.name,
    subtitle: row.email ?? row.phone ?? null,
    bookingCount:
      row._count.customerBookings + row._count.venueBookings + row._count.bookingAgentBookings,
  };
}

// ADR-0067 §5: non-cancelled bookings sort above cancelled (cancelled sunk to the bottom);
// within each of those two groups, upcoming events sort soonest-first and past events sort
// most-recent-first. `now` is passed in (rather than read internally) so ordering is testable
// without faking the system clock.
export function compareBookingRows(a: BookingSearchRow, b: BookingSearchRow, now: Date): number {
  const aCancelled = a.status === 'CANCELLED';
  const bCancelled = b.status === 'CANCELLED';
  if (aCancelled !== bCancelled) return aCancelled ? 1 : -1;

  const aFuture = a.date.getTime() >= now.getTime();
  const bFuture = b.date.getTime() >= now.getTime();
  if (aFuture !== bFuture) return aFuture ? -1 : 1;

  return aFuture
    ? a.date.getTime() - b.date.getTime() // upcoming: soonest first
    : b.date.getTime() - a.date.getTime(); // past: most recent first
}

// ADR-0067 §5: contacts order by total booking count, descending (the people worked with most
// surface first). Ties keep the DB's natural order (Array#sort is stable).
export function compareContactRows(a: ContactSearchRow, b: ContactSearchRow): number {
  const countOf = (row: ContactSearchRow) =>
    row._count.customerBookings + row._count.venueBookings + row._count.bookingAgentBookings;
  return countOf(b) - countOf(a);
}

@Injectable()
export class SearchService {
  constructor(private repo: SearchRepository) {}

  async search(userId: string, q: string | undefined): Promise<SearchResultDto[]> {
    const now = new Date();
    const [bookingRows, contactRows] = await Promise.all([
      this.repo.searchBookings(userId, q),
      this.repo.searchContacts(userId, q),
    ]);

    const bookings = [...bookingRows]
      .sort((a, b) => compareBookingRows(a, b, now))
      .slice(0, TOP_N_PER_TYPE)
      .map(toBookingResult);

    const contacts = [...contactRows]
      .sort(compareContactRows)
      .slice(0, TOP_N_PER_TYPE)
      .map(toContactResult);

    // Grouped by type — bookings first (§5) — not interleaved by any cross-type score.
    return [...bookings, ...contacts];
  }
}
