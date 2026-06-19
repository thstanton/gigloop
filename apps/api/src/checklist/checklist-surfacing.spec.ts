import { surfaceActionItems, addDays, SurfaceableItem } from './checklist-surfacing';

const CUTOFF = new Date('2025-01-13T00:00:00.000Z');
const WITHIN = new Date('2025-01-10T00:00:00.000Z'); // before cutoff
const BEYOND = new Date('2025-01-20T00:00:00.000Z'); // after cutoff

function item(overrides: Partial<SurfaceableItem> = {}): SurfaceableItem {
  return { dueDate: null, requiredForStatus: null, ...overrides };
}

describe('surfaceActionItems', () => {
  describe('stage gate', () => {
    it('drops an item required for a stage the booking has already passed', () => {
      // deposit (requiredForStatus CONFIRMED), dated within window, on a COMPLETE booking
      const deposit = item({ dueDate: WITHIN, requiredForStatus: 'CONFIRMED' });

      expect(surfaceActionItems([deposit], 'COMPLETE', CUTOFF)).toHaveLength(0);
    });

    it('keeps the same item while the booking is still at that stage', () => {
      const deposit = item({ dueDate: WITHIN, requiredForStatus: 'CONFIRMED' });

      expect(surfaceActionItems([deposit], 'CONFIRMED', CUTOFF)).toHaveLength(1);
    });

    it('drops a past-stage item as soon as the booking moves one stage on', () => {
      const deposit = item({ dueDate: WITHIN, requiredForStatus: 'CONFIRMED' });

      expect(surfaceActionItems([deposit], 'READY', CUTOFF)).toHaveLength(0);
    });

    it('keeps an item required for a future stage', () => {
      const balance = item({ dueDate: WITHIN, requiredForStatus: 'READY' });

      expect(surfaceActionItems([balance], 'CONFIRMED', CUTOFF)).toHaveLength(1);
    });

    it('the stage gate takes precedence over the dated-within-window rule', () => {
      // This is the bug: a dated item within the lead window must still be
      // dropped once its stage has passed.
      const deposit = item({ dueDate: WITHIN, requiredForStatus: 'CONFIRMED' });

      expect(surfaceActionItems([deposit], 'COMPLETE', CUTOFF)).toHaveLength(0);
    });

    it('never gates items with no requiredForStatus', () => {
      const adhoc = item({ dueDate: WITHIN, requiredForStatus: null });

      expect(surfaceActionItems([adhoc], 'COMPLETE', CUTOFF)).toHaveLength(1);
    });
  });

  describe('dated items', () => {
    it('surfaces a dated item within the cutoff', () => {
      expect(surfaceActionItems([item({ dueDate: WITHIN })], 'PROVISIONAL', CUTOFF)).toHaveLength(1);
    });

    it('does not surface a dated item beyond the cutoff', () => {
      expect(surfaceActionItems([item({ dueDate: BEYOND })], 'PROVISIONAL', CUTOFF)).toHaveLength(0);
    });

    it('surfaces a dated item exactly on the cutoff', () => {
      expect(surfaceActionItems([item({ dueDate: CUTOFF })], 'PROVISIONAL', CUTOFF)).toHaveLength(1);
    });
  });

  describe('undated status-gate items', () => {
    it('surfaces an undated item when it is the only blocker for its status', () => {
      const only = item({ requiredForStatus: 'CONFIRMED' });

      expect(surfaceActionItems([only], 'CONFIRMED', CUTOFF)).toHaveLength(1);
    });

    it('does not surface an undated item when peers block the same status', () => {
      const a = item({ requiredForStatus: 'CONFIRMED' });
      const b = item({ requiredForStatus: 'CONFIRMED' });

      expect(surfaceActionItems([a, b], 'CONFIRMED', CUTOFF)).toHaveLength(0);
    });

    it('does not surface an undated item with no requiredForStatus', () => {
      expect(surfaceActionItems([item()], 'CONFIRMED', CUTOFF)).toHaveLength(0);
    });
  });

  // add_venue (PRD #511 Module D) is an undated, READY-staged item — it flows through the
  // generic filter with no special-casing. These assert its concrete shape respects the gate.
  describe('add_venue (undated, READY-staged)', () => {
    const addVenue = () => item({ dueDate: null, requiredForStatus: 'READY' });

    it('surfaces on a confirmed booking when it is the only READY blocker', () => {
      expect(surfaceActionItems([addVenue()], 'CONFIRMED', CUTOFF)).toHaveLength(1);
    });

    it('respects the stage gate — drops once the booking has passed READY', () => {
      expect(surfaceActionItems([addVenue()], 'COMPLETE', CUTOFF)).toHaveLength(0);
    });
  });
});

describe('addDays', () => {
  it('adds days without mutating the input', () => {
    const base = new Date('2025-01-06T00:00:00.000Z');
    const result = addDays(base, 7);

    expect(result.toISOString()).toBe('2025-01-13T00:00:00.000Z');
    expect(base.toISOString()).toBe('2025-01-06T00:00:00.000Z');
  });
});
