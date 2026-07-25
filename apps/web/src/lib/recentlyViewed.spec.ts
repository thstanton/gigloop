import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentlyViewed, recordRecentlyViewed } from './recentlyViewed';
import type { BookingSearchResult } from '@/types/api';

function booking(id: string): BookingSearchResult {
  return {
    type: 'booking',
    id,
    url: `/admin/bookings/${id}`,
    title: `Booking ${id}`,
    subtitle: null,
    status: 'CONFIRMED',
    date: '2026-08-01T00:00:00.000Z',
    eventType: 'WEDDING',
  };
}

describe('recentlyViewed', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns [] when nothing has been recorded', () => {
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('records most-recent first', () => {
    recordRecentlyViewed(booking('1'));
    recordRecentlyViewed(booking('2'));
    expect(getRecentlyViewed().map((r) => r.id)).toEqual(['2', '1']);
  });

  it('de-duplicates by type+id, moving the re-viewed item to the front', () => {
    recordRecentlyViewed(booking('1'));
    recordRecentlyViewed(booking('2'));
    recordRecentlyViewed(booking('1'));
    expect(getRecentlyViewed().map((r) => r.id)).toEqual(['1', '2']);
  });

  it('caps the list at six, dropping the oldest', () => {
    for (let i = 0; i < 10; i += 1) recordRecentlyViewed(booking(String(i)));
    const ids = getRecentlyViewed().map((r) => r.id);
    expect(ids).toHaveLength(6);
    expect(ids[0]).toBe('9');
    expect(ids).not.toContain('3');
  });

  it('returns [] when the stored value is corrupt', () => {
    window.localStorage.setItem('gigloop:recentlyViewed', 'not json');
    expect(getRecentlyViewed()).toEqual([]);
  });
});
