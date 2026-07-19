import { describe, it, expect } from 'vitest';
import { selectEligibleTips, pickTip, TIP_POOL, type Tip, type TipSnapshot } from './tipEngine';

const allSetUp: TipSnapshot = {
  hasHomeAddress: true,
  hasLogo: true,
  noCustomPackage: false,
  usesDefaultPortalBranding: false,
  songRequestsEnabled: true,
  hasSongs: true,
};
const nothingSetUp: TipSnapshot = {
  hasHomeAddress: false,
  hasLogo: false,
  noCustomPackage: true,
  usesDefaultPortalBranding: true,
  songRequestsEnabled: true,
  hasSongs: false,
};

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

// Onboarding steps 3–5 leave an observable trace when skipped; each maps to one precondition (#669).
describe('onboarding skip preconditions', () => {
  const ids = (s: TipSnapshot) => selectEligibleTips(s, []).map((t) => t.id);

  it('surfaces the package tip when the library holds no template of the musician’s own', () => {
    expect(ids({ ...allSetUp, noCustomPackage: true })).toContain('packages-still-default');
  });

  it('surfaces the portal tip while the portal still carries the shipped branding', () => {
    expect(ids({ ...allSetUp, usesDefaultPortalBranding: true })).toContain(
      'portal-default-branding',
    );
  });

  it('drops the portal tip once the branding has been changed', () => {
    expect(ids({ ...allSetUp, usesDefaultPortalBranding: false })).not.toContain(
      'portal-default-branding',
    );
  });

  it('surfaces the repertoire tip when song requests are on and no song has been added', () => {
    expect(ids({ ...allSetUp, songRequestsEnabled: true, hasSongs: false })).toContain(
      'repertoire-empty',
    );
  });
});

describe('song requests turned off', () => {
  const ids = (s: TipSnapshot) => selectEligibleTips(s, []).map((t) => t.id);

  it('never surfaces a song-request tip, even with an empty repertoire', () => {
    expect(ids({ ...nothingSetUp, songRequestsEnabled: false })).not.toContain('repertoire-empty');
  });

  it('leaves the unrelated tips alone', () => {
    expect(ids({ ...nothingSetUp, songRequestsEnabled: false })).toContain('home-address-missing');
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
