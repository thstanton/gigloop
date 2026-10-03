import { describe, it, expect } from 'vitest';
import { callTimeParts, joinSegments, lineupName, packageBand, playerMeta, playsLine, segmentsLine } from './bandParts';
import type { BookingBandChair, BookingChairCallTime, BookingLineup, BookingPackageSummary } from '@/types/api';

describe('joinSegments', () => {
  it('returns the single label unchanged', () => {
    expect(joinSegments(['Drinks Reception'])).toBe('Drinks Reception');
  });

  it('joins two labels with "and"', () => {
    expect(joinSegments(['Drinks Reception', 'Evening Party'])).toBe('Drinks Reception and Evening Party');
  });

  it('joins three or more labels with commas and a trailing "and"', () => {
    expect(joinSegments(['Drinks', 'Evening', 'Late Set'])).toBe('Drinks, Evening and Late Set');
  });

  it('returns an empty string for an empty list', () => {
    expect(joinSegments([])).toBe('');
  });
});

// #989: this wording is shared with the create-time musician's declared choice (lineupChoices.ts)
// against PackageTemplate labels, not just persisted Lineups — the one-declaration-per-vocabulary
// rule this repo follows after booking status was once declared 13 times.
describe('segmentsLine', () => {
  it('reads "Plays X and Y" for a non-empty label set, no warning', () => {
    expect(segmentsLine(['Drinks Reception', 'Evening Party'], true)).toEqual({
      text: 'Plays Drinks Reception and Evening Party',
      warning: false,
    });
  });

  it('reads "Plays nothing yet" with a warning when packages exist but none are linked', () => {
    expect(segmentsLine([], true)).toEqual({ text: 'Plays nothing yet', warning: true });
  });

  it('reads "Plays the whole gig" with no warning when there are no packages at all', () => {
    expect(segmentsLine([], false)).toEqual({ text: 'Plays the whole gig', warning: false });
  });
});

// #1039 follow-up: a part plays every segment its band plays, so it is called to every one of
// them. The row showed only the earliest, which hid the second call entirely.
describe('callTimeParts', () => {
  const chair = (callTimes: BookingChairCallTime[]): BookingBandChair =>
    ({ id: 'ch1', role: 'Bass', order: 1, lineupId: 'lu1', memberId: null, callTimes }) as BookingBandChair;

  it('names the segment beside each call, one per segment the band plays', () => {
    expect(
      callTimeParts(
        chair([
          { segmentId: 'p1', segmentLabel: 'Drinks Reception', startTime: '18:00' },
          { segmentId: 'p2', segmentLabel: 'Evening Party', startTime: '20:30' },
        ]),
        true,
      ),
    ).toEqual(['18:00 Drinks Reception', '20:30 Evening Party']);
  });

  it('reads the package-less bucket as "Whole gig" on a booking with no packages', () => {
    expect(callTimeParts(chair([{ segmentId: null, segmentLabel: null, startTime: '18:00' }]), false)).toEqual([
      '18:00 Whole gig',
    ]);
  });

  // The same null bucket on a booking that HAS packages is a band parked with nothing to play yet
  // (ADR-0081 §4) — naming a segment there would be a lie, so the bare time stands alone.
  it('leaves the package-less bucket bare on a booking that has packages', () => {
    expect(callTimeParts(chair([{ segmentId: null, segmentLabel: null, startTime: '18:00' }]), true)).toEqual(['18:00']);
  });

  it('is empty when no segment the band plays has a timed set — absent, not zero', () => {
    expect(callTimeParts(chair([]), true)).toEqual([]);
  });
});

describe('playsLine', () => {
  const packages: BookingPackageSummary[] = [
    { id: 'p1', label: 'Drinks Reception' } as BookingPackageSummary,
    { id: 'p2', label: 'Evening Party' } as BookingPackageSummary,
  ];

  it('delegates to segmentsLine using this Lineup\'s own segment labels', () => {
    const lineup = { packageIds: ['p1', 'p2'] } as BookingLineup;
    expect(playsLine(lineup, packages)).toEqual({ text: 'Plays Drinks Reception and Evening Party', warning: false });
  });

  it('warns when the booking has packages but this Lineup plays none of them', () => {
    const lineup = { packageIds: [] } as unknown as BookingLineup;
    expect(playsLine(lineup, packages)).toEqual({ text: 'Plays nothing yet', warning: true });
  });

  it('reads "Plays the whole gig" on a package-less booking', () => {
    const lineup = { packageIds: [] } as unknown as BookingLineup;
    expect(playsLine(lineup, [])).toEqual({ text: 'Plays the whole gig', warning: false });
  });
});

describe('lineupName', () => {
  const chairsOf = (n: number): BookingBandChair[] =>
    Array.from({ length: n }, (_, i) => ({ id: `c${i}`, role: 'r', order: i, lineupId: 'l', memberId: null, callTimes: [] }));

  it('prefers the lineup\'s own label', () => {
    expect(lineupName({ id: 'l', label: 'The Quartet', packageIds: [] }, chairsOf(4))).toBe('The Quartet');
  });

  it('names an unnamed lineup by its size, never "Band" (ADR-0084 §2)', () => {
    const unnamed = { id: 'l', label: null, packageIds: [] };
    expect(lineupName(unnamed, chairsOf(1))).toBe('Solo');
    expect(lineupName(unnamed, chairsOf(2))).toBe('Duo');
    expect(lineupName(unnamed, chairsOf(3))).toBe('Trio');
    expect(lineupName(unnamed, chairsOf(5))).toBe('5-piece');
  });
});

describe('packageBand', () => {
  const packages = [
    { id: 'cer', order: 0, label: 'Ceremony', icon: 'heart' },
    { id: 'dri', order: 1, label: 'Drinks', icon: 'martini' },
    { id: 'eve', order: 2, label: 'Evening', icon: 'guitar' },
  ] as BookingPackageSummary[];
  const part = (id: string, lineupId: string, memberId: string | null): BookingBandChair => ({
    id, role: id, order: 0, lineupId, memberId, callTimes: [],
  });
  const me = { id: 'me', isSelf: true, status: 'CONFIRMED' } as const;
  const ana = { id: 'ana', isSelf: false, status: 'CONFIRMED' } as const;
  const ben = { id: 'ben', isSelf: false, status: 'INVITED' } as const;

  it('is null for a package with no lineup (Decide later)', () => {
    expect(packageBand('cer', packages, [], [], [])).toBeNull();
  });

  it('says "you" for a solo lineup the organiser plays', () => {
    const lineups = [{ id: 'l', label: null, packageIds: ['cer'] }];
    expect(packageBand('cer', packages, lineups, [part('a', 'l', 'me')], [me])?.summary).toEqual({ kind: 'you' });
  });

  it('counts empty parts as still to fill, ahead of anyone waiting', () => {
    const lineups = [{ id: 'l', label: null, packageIds: ['eve'] }];
    const chairs = [part('a', 'l', 'ana'), part('b', 'l', 'ben'), part('c', 'l', null), part('d', 'l', null)];
    expect(packageBand('eve', packages, lineups, chairs, [ana, ben])?.summary).toEqual({ kind: 'toFill', count: 2 });
  });

  it('says all confirmed once every part is held by a confirmed player', () => {
    const lineups = [{ id: 'l', label: null, packageIds: ['dri'] }];
    expect(packageBand('dri', packages, lineups, [part('a', 'l', 'ana'), part('b', 'l', 'me')], [ana, me])?.summary)
      .toEqual({ kind: 'allConfirmed' });
  });

  it('lists a shared lineup under its earliest package only; later ones read "same as"', () => {
    const lineups = [{ id: 'l', label: null, packageIds: ['dri', 'cer'] }];
    const chairs = [part('a', 'l', 'ana'), part('b', 'l', 'me')];
    expect(packageBand('cer', packages, lineups, chairs, [ana, me])?.parts).toHaveLength(2);
    const later = packageBand('dri', packages, lineups, chairs, [ana, me]);
    expect(later?.summary).toEqual({ kind: 'sameAs', packageLabel: 'Ceremony' });
    expect(later?.parts).toEqual([]);
  });
});

describe('playerMeta', () => {
  const packages = [
    { id: 'dri', order: 0, label: 'Drinks' },
    { id: 'eve', order: 1, label: 'Evening' },
  ] as BookingPackageSummary[];
  const lineups = [
    { id: 'big', label: null, packageIds: ['eve', 'dri'] },
    { id: 'solo', label: null, packageIds: ['dri'] },
  ] as BookingLineup[];
  const part = (id: string, role: string, lineupId: string, order = 0, memberId: string | null = 'ana') =>
    ({ id, role, lineupId, order, memberId, callTimes: [] }) as BookingBandChair;

  it('reads "{roles} · {packages}" with packages in booking order', () => {
    expect(playerMeta('ana', [part('a', 'Bass', 'big')], lineups, packages)).toBe('Bass · Drinks, Evening');
  });

  it('lists each distinct role once and unions the packages across lineups', () => {
    const chairs = [part('a', 'Bass', 'big', 0), part('b', 'Bass', 'solo', 1), part('c', 'Piano', 'solo', 2)];
    expect(playerMeta('ana', chairs, lineups, packages)).toBe('Bass, Piano · Drinks, Evening');
  });

  it('drops the packages half on a booking with none — never "Whole gig"', () => {
    const bare = [{ id: 'l', label: null, packageIds: [] }] as BookingLineup[];
    expect(playerMeta('ana', [part('a', 'Bass', 'l')], bare, [])).toBe('Bass');
  });

  it('is empty for someone holding no part', () => {
    expect(playerMeta('ana', [], lineups, packages)).toBe('');
  });
});
