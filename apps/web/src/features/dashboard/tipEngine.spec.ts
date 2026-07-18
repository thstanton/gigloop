import { describe, it, expect } from 'vitest';
import { selectEligibleTips, pickTip, TIP_POOL, type Tip, type TipSnapshot } from './tipEngine';

const allSetUp: TipSnapshot = { hasHomeAddress: true, hasLogo: true, noCustomPackage: false };
const nothingSetUp: TipSnapshot = { hasHomeAddress: false, hasLogo: false, noCustomPackage: true };

describe('selectEligibleTips', () => {
  it('includes a tip whose precondition is met and which is not dismissed', () => {
    const eligible = selectEligibleTips(nothingSetUp, []);
    expect(eligible.map((t) => t.id)).toContain('home-address-missing');
  });

  it('excludes a dismissed tip', () => {
    const eligible = selectEligibleTips(nothingSetUp, ['home-address-missing']);
    expect(eligible.map((t) => t.id)).not.toContain('home-address-missing');
  });

  it('excludes a tip whose precondition is already satisfied', () => {
    // hasHomeAddress true → the home-address tip should not be eligible.
    const eligible = selectEligibleTips(allSetUp, []);
    expect(eligible.map((t) => t.id)).not.toContain('home-address-missing');
  });

  it('returns nothing when everything is set up', () => {
    expect(selectEligibleTips(allSetUp, [])).toEqual([]);
  });
});

describe('pickTip', () => {
  const a = { id: 'a' } as Tip;
  const b = { id: 'b' } as Tip;
  const c = { id: 'c' } as Tip;

  it('returns null when nothing is eligible', () => {
    expect(pickTip([], 0)).toBeNull();
  });

  it('is deterministic for a given seed', () => {
    expect(pickTip([a, b, c], 1)?.id).toBe('b');
    expect(pickTip([a, b, c], 1)?.id).toBe('b');
  });

  it('rotates across seeds and wraps around', () => {
    expect(pickTip([a, b, c], 0)?.id).toBe('a');
    expect(pickTip([a, b, c], 1)?.id).toBe('b');
    expect(pickTip([a, b, c], 2)?.id).toBe('c');
    expect(pickTip([a, b, c], 3)?.id).toBe('a');
  });
});

describe('TIP_POOL integrity', () => {
  it('has unique ids', () => {
    const ids = TIP_POOL.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every tip has non-empty text and an internal href', () => {
    for (const tip of TIP_POOL) {
      expect(tip.text.length).toBeGreaterThan(0);
      expect(tip.href.startsWith('/')).toBe(true);
    }
  });
});
