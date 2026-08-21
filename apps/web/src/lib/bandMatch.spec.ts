import { describe, it, expect } from 'vitest';
import { contactMatchesChairRole, haversineKm, rankContactsForChair, softMatchesRole } from './bandMatch';

describe('softMatchesRole', () => {
  it('matches an abbreviation against its full form', () => {
    expect(softMatchesRole('Sax', 'Saxophone')).toBe(true);
    expect(softMatchesRole('Saxophone', 'Sax')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(softMatchesRole('sax', 'SAXOPHONE')).toBe(true);
  });

  it('does not match unrelated strings', () => {
    expect(softMatchesRole('Drums', 'Vocals')).toBe(false);
  });

  it('treats blank input as no match', () => {
    expect(softMatchesRole('', 'Sax')).toBe(false);
    expect(softMatchesRole('Sax', '')).toBe(false);
  });
});

describe('contactMatchesChairRole', () => {
  it('matches on primaryBandRole', () => {
    expect(contactMatchesChairRole({ primaryBandRole: 'Saxophone', instruments: [] }, 'Sax')).toBe(true);
  });

  it('matches on any declared instrument', () => {
    expect(
      contactMatchesChairRole({ primaryBandRole: null, instruments: ['Bass', 'Sax'] }, 'Saxophone'),
    ).toBe(true);
  });

  it('does not match when the chair role is blank', () => {
    expect(contactMatchesChairRole({ primaryBandRole: 'Sax', instruments: [] }, '')).toBe(false);
  });

  it('does not match when nothing overlaps', () => {
    expect(contactMatchesChairRole({ primaryBandRole: 'Drums', instruments: ['Percussion'] }, 'Sax')).toBe(false);
  });
});

describe('haversineKm', () => {
  it('returns ~0 for the same point', () => {
    const p = { latitude: 51.5, longitude: -0.12 };
    expect(haversineKm(p, p)).toBeCloseTo(0, 5);
  });

  it('returns the known London–Paris great-circle distance (~344km)', () => {
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    expect(haversineKm(london, paris)).toBeCloseTo(344, -1);
  });
});

const venue = { latitude: 51.5, longitude: -0.1 };

function contact(id: string, opts: Partial<{ primaryBandRole: string | null; instruments: string[]; latitude: number | null; longitude: number | null }> = {}) {
  return {
    id,
    primaryBandRole: opts.primaryBandRole ?? null,
    instruments: opts.instruments ?? [],
    latitude: opts.latitude ?? null,
    longitude: opts.longitude ?? null,
  };
}

describe('rankContactsForChair', () => {
  it('ranks nearer contacts first when both venue and contacts have coordinates', () => {
    const near = contact('near', { latitude: 51.51, longitude: -0.11 });
    const far = contact('far', { latitude: 52.5, longitude: -1.9 }); // Birmingham-ish
    const ranked = rankContactsForChair([far, near], '', venue);
    expect(ranked.map((c) => c.id)).toEqual(['near', 'far']);
  });

  it('a soft role/instrument match outranks a nearer non-matching contact', () => {
    const nearNoMatch = contact('near-no-match', { latitude: 51.51, longitude: -0.11 });
    const farMatch = contact('far-match', { primaryBandRole: 'Saxophone', latitude: 52.5, longitude: -1.9 });
    const ranked = rankContactsForChair([nearNoMatch, farMatch], 'Sax', venue);
    expect(ranked.map((c) => c.id)).toEqual(['far-match', 'near-no-match']);
  });

  it('degrades silently — never drops a contact — when the venue has no coordinates', () => {
    const a = contact('a', { latitude: 51.51, longitude: -0.11 });
    const b = contact('b', { latitude: null, longitude: null });
    const ranked = rankContactsForChair([a, b], '', null);
    expect(ranked.map((c) => c.id).sort((x, y) => x.localeCompare(y))).toEqual(['a', 'b']);
  });

  it('pushes contacts with no coordinates after contacts with a known distance', () => {
    const noCoords = contact('no-coords');
    const withCoords = contact('with-coords', { latitude: 51.9, longitude: -0.5 });
    const ranked = rankContactsForChair([noCoords, withCoords], '', venue);
    expect(ranked.map((c) => c.id)).toEqual(['with-coords', 'no-coords']);
  });

  it('preserves incoming order when nothing distinguishes two contacts', () => {
    const a = contact('a');
    const b = contact('b');
    const ranked = rankContactsForChair([a, b], '', null);
    expect(ranked.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
