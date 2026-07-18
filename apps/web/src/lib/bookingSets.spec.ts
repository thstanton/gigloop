import { describe, it, expect } from 'vitest';
import { buildSetsDescription } from './bookingSets';
import type { BookingDetail, PerformanceSet } from '@/types/api';

const set = (o: Partial<PerformanceSet>): PerformanceSet => ({
  id: 's', order: 0, duration: 60, startTime: null, label: null, packageId: null, ...o,
});

// buildSetsDescription only reads `sets` and `packages`, so a partial BookingDetail is sufficient.
const booking = (o: Partial<BookingDetail>): BookingDetail => ({ sets: [], packages: [], ...o }) as BookingDetail;

describe('buildSetsDescription', () => {
  it('returns empty string when there is no booking', () => {
    expect(buildSetsDescription(undefined)).toBe('');
  });

  it('returns empty string when there are no sets', () => {
    expect(buildSetsDescription(booking({ sets: [] }))).toBe('');
  });

  it('uses the set label when present', () => {
    expect(buildSetsDescription(booking({ sets: [set({ label: 'First dance', duration: 45 })] }))).toBe(
      'First dance (45 min)',
    );
  });

  it('falls back to the package label when the set has none', () => {
    expect(
      buildSetsDescription(
        booking({
          sets: [set({ label: null, packageId: 'p1', duration: 90 })],
          packages: [{ id: 'p1', order: 0, label: 'Evening set', icon: 'music' }],
        }),
      ),
    ).toBe('Evening set (90 min)');
  });

  it('falls back to the bare duration when neither label nor package matches', () => {
    expect(buildSetsDescription(booking({ sets: [set({ label: null, packageId: null, duration: 30 })] }))).toBe(
      '30 min',
    );
  });

  it('joins multiple sets with a comma', () => {
    expect(
      buildSetsDescription(
        booking({ sets: [set({ label: 'A', duration: 30 }), set({ id: 's2', label: 'B', duration: 60 })] }),
      ),
    ).toBe('A (30 min), B (60 min)');
  });
});
