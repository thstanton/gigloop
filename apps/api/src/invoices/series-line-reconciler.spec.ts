import { reconcile } from './series-line-reconciler';

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
