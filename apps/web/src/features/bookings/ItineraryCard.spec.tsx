import { describe, it, expect } from 'vitest';
import { orderTimelineSets } from './ItineraryCard';
import type { BookingPackageSummary, PerformanceSet } from '@/types/api';

function set(partial: Partial<PerformanceSet> & { id: string }): PerformanceSet {
  return {
    id: partial.id,
    order: partial.order ?? 0,
    duration: partial.duration ?? 30,
    startTime: partial.startTime ?? null,
    label: partial.label ?? null,
    packageId: partial.packageId ?? null,
  };
}

function pkg(id: string, order: number): BookingPackageSummary {
  return { id, order, label: id, icon: 'music' };
}

describe('orderTimelineSets', () => {
  const ceremony = pkg('ceremony', 0);
  const drinks = pkg('drinks', 1);
  const dinner = pkg('dinner', 2);
  const packages = [ceremony, drinks, dinner];

  it('orders by start time across packages — not by per-package set order (ADR-0046)', () => {
    // Ceremony has no time (leads via package order); the rest are timed and must
    // interleave chronologically rather than by their per-package set index.
    const sets = [
      set({ id: 'ceremony-1', packageId: 'ceremony', order: 0, startTime: null }),
      set({ id: 'drinks-A', packageId: 'drinks', order: 0, startTime: '14:00' }),
      set({ id: 'drinks-B', packageId: 'drinks', order: 1, startTime: '15:00' }),
      set({ id: 'dinner-A', packageId: 'dinner', order: 0, startTime: '15:30' }),
      set({ id: 'dinner-B', packageId: 'dinner', order: 1, startTime: '17:00' }),
    ];
    // Intentionally shuffle to prove the sort, not the input order, decides output.
    const shuffled = [sets[3], sets[1], sets[4], sets[0], sets[2]];

    expect(orderTimelineSets(shuffled, packages).map((s) => s.id)).toEqual([
      'ceremony-1', // untimed → leads, by package order
      'drinks-A', // 14:00
      'drinks-B', // 15:00
      'dinner-A', // 15:30
      'dinner-B', // 17:00
    ]);
  });

  it('interleaves sets from different packages by clock time (decoupled from grouping)', () => {
    // A dinner set scheduled before a drinks set must appear first, despite dinner's
    // later package order — start time is canonical.
    const sets = [
      set({ id: 'drinks-late', packageId: 'drinks', order: 0, startTime: '16:00' }),
      set({ id: 'dinner-early', packageId: 'dinner', order: 0, startTime: '15:00' }),
    ];
    expect(orderTimelineSets(sets, packages).map((s) => s.id)).toEqual([
      'dinner-early',
      'drinks-late',
    ]);
  });

  it('falls back to package order then set order when no times are set', () => {
    const sets = [
      set({ id: 'dinner-1', packageId: 'dinner', order: 1 }),
      set({ id: 'drinks-1', packageId: 'drinks', order: 0 }),
      set({ id: 'dinner-0', packageId: 'dinner', order: 0 }),
      set({ id: 'ceremony-0', packageId: 'ceremony', order: 0 }),
    ];
    expect(orderTimelineSets(sets, packages).map((s) => s.id)).toEqual([
      'ceremony-0',
      'drinks-1',
      'dinner-0',
      'dinner-1',
    ]);
  });

  it('untimed sets lead timed sets, then ungrouped sets sort last among the fallback', () => {
    const sets = [
      set({ id: 'timed', packageId: 'drinks', order: 0, startTime: '14:00' }),
      set({ id: 'ungrouped-untimed', packageId: null, order: 0 }),
      set({ id: 'grouped-untimed', packageId: 'ceremony', order: 0 }),
    ];
    expect(orderTimelineSets(sets, packages).map((s) => s.id)).toEqual([
      'grouped-untimed', // untimed, package order 0
      'ungrouped-untimed', // untimed, no package → sorts last among untimed
      'timed', // timed sets follow
    ]);
  });
});
