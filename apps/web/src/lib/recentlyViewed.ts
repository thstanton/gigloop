import type { BookingDetail, ContactDetail, SearchResult } from '@/types/api';

// Client-side "recently viewed" for the command palette's cold-open state (ADR-0067 §7). Kept as a
// small localStorage list of SearchResult snapshots — the same shape the /search endpoint returns —
// so the palette renders recents with the very same SearchResultRow. No API, no schema (the ADR's
// chosen default; a server signal is the noted fallback if this proves insufficient).

const STORAGE_KEY = 'gigloop:recentlyViewed';
const MAX_ITEMS = 6;

const keyOf = (item: Pick<SearchResult, 'type' | 'id'>) => `${item.type}:${item.id}`;

/** Project a viewed booking to the palette's booking result shape (mirrors the API's toBookingResult). */
export function bookingToRecent(booking: BookingDetail): SearchResult {
  return {
    type: 'booking',
    id: booking.id,
    url: `/admin/bookings/${booking.id}`,
    title: booking.title ?? booking.customer.name,
    subtitle: booking.venue?.name ?? null,
    status: booking.status,
    date: booking.date,
    eventType: booking.eventType,
  };
}

/** Project a viewed contact to the palette's contact result shape (mirrors the API's toContactResult). */
export function contactToRecent(contact: ContactDetail): SearchResult {
  return {
    type: 'contact',
    id: contact.id,
    url: `/admin/contacts/${contact.id}`,
    title: contact.name,
    subtitle: contact.email ?? contact.phone ?? null,
    bookingCount:
      contact.customerBookings.length +
      contact.venueBookings.length +
      contact.bookingAgentBookings.length,
  };
}

/** The recently-viewed list, most-recent first. Returns [] if storage is empty or unreadable. */
export function getRecentlyViewed(): SearchResult[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SearchResult[]) : [];
  } catch {
    return [];
  }
}

/** Record a viewed item at the front of the list, de-duplicated by type+id and capped at MAX_ITEMS. */
export function recordRecentlyViewed(item: SearchResult): void {
  try {
    const next = [item, ...getRecentlyViewed().filter((r) => keyOf(r) !== keyOf(item))].slice(
      0,
      MAX_ITEMS,
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable/full — recents are best-effort and must never block navigation.
  }
}
