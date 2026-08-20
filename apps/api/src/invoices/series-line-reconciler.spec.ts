import { computeJoinInsertion, reconcile } from './series-line-reconciler';
import type { OrderedLine } from './series-line-reconciler';

const booking = (id: string): { id: string; description: string; amount: number } => ({
  id,
  description: `Gig on ${id}`,
  amount: 500,
});

describe('reconcile', () => {
  it('adds a line for a new member with no existing line', () => {
    const result = reconcile([], [booking('b1')]);
    expect(result.add).toEqual([booking('b1')]);
    expect(result.removeIds).toEqual([]);
  });

  it('removes the line when a member has left', () => {
    const existingLines = [{ id: 'li1', sourceBookingId: 'b1' }];
    const result = reconcile(existingLines, []);
    expect(result.add).toEqual([]);
    expect(result.removeIds).toEqual(['li1']);
  });

  it('leaves a still-member line unchanged (no add, no remove)', () => {
    const existingLines = [{ id: 'li1', sourceBookingId: 'b1' }];
    const result = reconcile(existingLines, [booking('b1')]);
    expect(result.add).toEqual([]);
    expect(result.removeIds).toEqual([]);
  });

  it('adds and removes in the same call when membership changes', () => {
    const existingLines = [
      { id: 'li1', sourceBookingId: 'b1' },
      { id: 'li2', sourceBookingId: 'b2' },
    ];
    const result = reconcile(existingLines, [booking('b2'), booking('b3')]);
    expect(result.add).toEqual([booking('b3')]);
    expect(result.removeIds).toEqual(['li1']);
  });

  it('never touches custom lines (null sourceBookingId)', () => {
    const existingLines = [
      { id: 'li-custom', sourceBookingId: null },
      { id: 'li1', sourceBookingId: 'b1' },
    ];
    const result = reconcile(existingLines, []);
    expect(result.removeIds).toEqual(['li1']);
    expect(result.removeIds).not.toContain('li-custom');
    expect(result.add).toEqual([]);
  });

  it('handles empty inputs — returns empty result', () => {
    const result = reconcile([], []);
    expect(result.add).toEqual([]);
    expect(result.removeIds).toEqual([]);
  });

  it('adds multiple new members', () => {
    const result = reconcile([], [booking('b1'), booking('b2'), booking('b3')]);
    expect(result.add).toHaveLength(3);
    expect(result.removeIds).toHaveLength(0);
  });
});

describe('computeJoinInsertion', () => {
  const auto = (id: string, order: number, date: string): OrderedLine => ({
    id, order, sourceBookingId: id, sourceBookingDate: new Date(date),
  });
  const custom = (id: string, order: number): OrderedLine => ({
    id, order, sourceBookingId: null, sourceBookingDate: null,
  });

  it('places the new line first when it is empty', () => {
    const result = computeJoinInsertion([], new Date('2026-06-01'));
    expect(result.newOrder).toBe(0);
    expect(result.reorder).toEqual([]);
  });

  it('appends after a later date with no reordering needed', () => {
    const existing = [auto('a1', 0, '2026-05-01')];
    const result = computeJoinInsertion(existing, new Date('2026-06-01'));
    expect(result.newOrder).toBe(1);
    expect(result.reorder).toEqual([]);
  });

  it('inserts before an earlier-dated line, bumping it up', () => {
    const existing = [auto('a1', 0, '2026-07-01')];
    const result = computeJoinInsertion(existing, new Date('2026-06-01'));
    expect(result.newOrder).toBe(0);
    expect(result.reorder).toEqual([{ id: 'a1', order: 1 }]);
  });

  it('inserts a retro-joined booking at its date position among several auto lines', () => {
    const existing = [
      auto('a1', 0, '2026-05-01'),
      auto('a2', 1, '2026-07-01'),
    ];
    const result = computeJoinInsertion(existing, new Date('2026-06-01'));
    expect(result.newOrder).toBe(1);
    expect(result.reorder).toEqual([{ id: 'a2', order: 2 }]);
  });

  it('keeps custom lines after every auto-generated line regardless of join order', () => {
    const existing = [
      auto('a1', 0, '2026-05-01'),
      custom('c1', 1),
    ];
    const result = computeJoinInsertion(existing, new Date('2026-06-01'));
    expect(result.newOrder).toBe(1);
    expect(result.reorder).toEqual([{ id: 'c1', order: 2 }]);
  });

  it('inserts before a custom line only when there are no later auto lines to bump instead', () => {
    const existing = [custom('c1', 0)];
    const result = computeJoinInsertion(existing, new Date('2026-06-01'));
    expect(result.newOrder).toBe(0);
    expect(result.reorder).toEqual([{ id: 'c1', order: 1 }]);
  });

  it('self-heals auto lines left out of date order by the pre-#851 bug', () => {
    // a2 (later date) was appended before a1 (earlier date) under the old bug — order says
    // a2 first, but its date is later. The new join re-sorts by date, not by stale order.
    const existing = [
      auto('a2', 0, '2026-07-01'),
      auto('a1', 1, '2026-05-01'),
    ];
    const result = computeJoinInsertion(existing, new Date('2026-06-01'));
    // Canonical date order is a1, NEW, a2 — a1 moves to 0, NEW takes 1, a2 moves to 2.
    expect(result.newOrder).toBe(1);
    expect(result.reorder).toEqual(expect.arrayContaining([
      { id: 'a1', order: 0 },
      { id: 'a2', order: 2 },
    ]));
  });

  it('does not reorder a line whose position is unchanged', () => {
    const existing = [
      auto('a1', 0, '2026-05-01'),
      auto('a2', 1, '2026-06-15'),
    ];
    const result = computeJoinInsertion(existing, new Date('2026-07-01'));
    expect(result.newOrder).toBe(2);
    expect(result.reorder).toEqual([]);
  });
});
