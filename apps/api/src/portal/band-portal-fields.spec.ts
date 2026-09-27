import {
  mapBandPortalView,
  BAND_PORTAL_FIELDS,
  type BandPortalMapperInput,
} from './band-portal-fields';

function baseInput(overrides: Partial<BandPortalMapperInput> = {}): BandPortalMapperInput {
  return {
    booking: { title: 'The Hartley Wedding', date: new Date('2027-06-12T00:00:00Z'), logistics: null },
    venue: null,
    sets: [],
    packages: [],
    lineups: [],
    chairs: [],
    self: { memberId: 'member-self', status: 'CONFIRMED', sessionFee: '150.00' },
    ...overrides,
  };
}

describe('BAND_PORTAL_FIELDS shape', () => {
  it('pins exactly the roster and self key sets, so a table row cannot silently drift from the view', () => {
    const view = mapBandPortalView(baseInput());
    const sortStrings = (values: string[]) => [...values].sort((a, b) => a.localeCompare(b));
    const rosterKeys = sortStrings(BAND_PORTAL_FIELDS.filter((f) => f.scope === 'roster').map((f) => f.key));
    const selfKeys = sortStrings(BAND_PORTAL_FIELDS.filter((f) => f.scope === 'self').map((f) => f.key));

    expect(sortStrings(Object.keys(view.roster))).toEqual(rosterKeys);
    expect(sortStrings(Object.keys(view.self))).toEqual(selfKeys);
  });

  it('declares exactly 8 roster fields and 3 self fields', () => {
    expect(BAND_PORTAL_FIELDS.filter((f) => f.scope === 'roster')).toHaveLength(8);
    expect(BAND_PORTAL_FIELDS.filter((f) => f.scope === 'self')).toHaveLength(3);
  });
});

describe('mapBandPortalView — booking identity', () => {
  it('carries the booking title as-is, never falling back to a customer name', () => {
    const view = mapBandPortalView(baseInput({ booking: { title: null, date: new Date('2027-01-01'), logistics: null } }));
    expect(view.roster.bookingTitle).toBeNull();
  });

  it('serialises the date as ISO', () => {
    const view = mapBandPortalView(baseInput());
    expect(view.roster.bookingDate).toBe('2027-06-12T00:00:00.000Z');
  });
});

describe('mapBandPortalView — venue', () => {
  it('is null when the booking has no venue', () => {
    const view = mapBandPortalView(baseInput({ venue: null }));
    expect(view.roster.venueName).toBeNull();
    expect(view.roster.venueAddress).toBeNull();
  });

  it('carries name and structured address fields only', () => {
    const view = mapBandPortalView(
      baseInput({
        venue: {
          name: 'The Old Barn',
          addressLine1: '1 Barn Lane',
          addressLine2: null,
          city: 'Bath',
          county: 'Somerset',
          postcode: 'BA1 1AA',
          country: 'GB',
        },
      }),
    );
    expect(view.roster.venueName).toBe('The Old Barn');
    expect(view.roster.venueAddress).toEqual({
      line1: '1 Barn Lane',
      line2: null,
      city: 'Bath',
      county: 'Somerset',
      postcode: 'BA1 1AA',
      country: 'GB',
    });
  });
});

describe('mapBandPortalView — roster chairs', () => {
  it('shows a vacant chair role-only, with no member name', () => {
    const view = mapBandPortalView(
      baseInput({
        chairs: [{ id: 'chair-1', role: 'Saxophone', lineupId: 'lineup-1', memberId: null, memberName: null }],
      }),
    );
    expect(view.roster.chairs).toEqual([
      { id: 'chair-1', role: 'Saxophone', memberName: null, callTimes: [] },
    ]);
  });

  it('shows a filled chair with the member name', () => {
    const view = mapBandPortalView(
      baseInput({
        chairs: [
          { id: 'chair-1', role: 'Drums', lineupId: 'lineup-1', memberId: 'member-1', memberName: 'Dave' },
        ],
      }),
    );
    expect(view.roster.chairs[0].memberName).toBe('Dave');
  });

  it('never exposes a memberId, sessionFee or status on a roster chair', () => {
    const view = mapBandPortalView(
      baseInput({
        chairs: [{ id: 'chair-1', role: 'Bass', lineupId: 'lineup-1', memberId: 'member-1', memberName: 'Priya' }],
      }),
    );
    const keys = Object.keys(view.roster.chairs[0]);
    expect(keys).not.toContain('memberId');
    expect(keys).not.toContain('sessionFee');
    expect(keys).not.toContain('status');
  });

  it('derives call times per chair from its Lineup segments, in package order', () => {
    const view = mapBandPortalView(
      baseInput({
        packages: [{ id: 'pkg-1', label: 'Reception', icon: 'wine', order: 0 }],
        sets: [{ order: 0, label: null, startTime: '18:00', duration: 60, packageId: 'pkg-1' }],
        lineups: [{ id: 'lineup-1', packageIds: ['pkg-1'] }],
        chairs: [{ id: 'chair-1', role: 'Sax', lineupId: 'lineup-1', memberId: null, memberName: null }],
      }),
    );
    expect(view.roster.chairs[0].callTimes).toEqual([
      { segmentId: 'pkg-1', segmentLabel: 'Reception', startTime: '18:00' },
    ]);
  });
});

describe('mapBandPortalView — self scope', () => {
  it('carries only the token member\'s own fee and status', () => {
    const view = mapBandPortalView(baseInput({ self: { memberId: 'member-self', status: 'DECLINED', sessionFee: '200.00' } }));
    expect(view.self.status).toBe('DECLINED');
    expect(view.self.sessionFee).toBe('200.00');
  });

  it('lists only this member\'s own chair ids, never another member\'s', () => {
    const view = mapBandPortalView(
      baseInput({
        self: { memberId: 'member-self', status: 'CONFIRMED', sessionFee: null },
        chairs: [
          { id: 'chair-self', role: 'Vocals', lineupId: 'l1', memberId: 'member-self', memberName: 'Me' },
          { id: 'chair-other', role: 'Guitar', lineupId: 'l1', memberId: 'member-other', memberName: 'Other Person' },
          { id: 'chair-vacant', role: 'Drums', lineupId: 'l1', memberId: null, memberName: null },
        ],
      }),
    );
    expect(view.self.ownChairIds).toEqual(['chair-self']);
  });
});

describe('mapBandPortalView — logistics field wall', () => {
  it('crosses only the declared shareWithBand keys, in canonical order', () => {
    const view = mapBandPortalView(
      baseInput({
        booking: {
          title: null,
          date: new Date('2027-01-01'),
          logistics: {
            finishTime: { value: '23:00' },
            arrivalTime: { value: '17:00' },
            dressCode: { value: 'Black Tie' },
            customField: { value: 'ignored' },
          },
        },
      }),
    );
    expect(view.roster.logistics).toEqual([
      { key: 'arrivalTime', value: '17:00' },
      { key: 'finishTime', value: '23:00' },
    ]);
  });

  it('never crosses dressCode — only the leader\'s own outfits implementation of it', () => {
    const view = mapBandPortalView(
      baseInput({
        booking: {
          title: null,
          date: new Date('2027-01-01'),
          logistics: { dressCode: { value: 'Cocktail' } },
        },
      }),
    );
    expect(view.roster.logistics).toEqual([]);
  });

  it('skips an empty or missing value for a shared key', () => {
    const view = mapBandPortalView(
      baseInput({
        booking: {
          title: null,
          date: new Date('2027-01-01'),
          logistics: { arrivalTime: { value: '' }, soundCheckTime: {} },
        },
      }),
    );
    expect(view.roster.logistics).toEqual([]);
  });

  it('is empty when the booking has no logistics at all', () => {
    const view = mapBandPortalView(baseInput({ booking: { title: null, date: new Date('2027-01-01'), logistics: null } }));
    expect(view.roster.logistics).toEqual([]);
  });
});

describe('mapBandPortalView — no fee leak (ADR-0073)', () => {
  it('never lets another member\'s fee reach the roster, no matter how many chairs/members exist', () => {
    const view = mapBandPortalView(
      baseInput({
        self: { memberId: 'member-self', status: 'CONFIRMED', sessionFee: '150.00' },
        chairs: [
          { id: 'chair-self', role: 'Vocals', lineupId: 'l1', memberId: 'member-self', memberName: 'Me' },
          { id: 'chair-other-1', role: 'Guitar', lineupId: 'l1', memberId: 'member-other-1', memberName: 'Other One' },
          { id: 'chair-other-2', role: 'Bass', lineupId: 'l1', memberId: 'member-other-2', memberName: 'Other Two' },
        ],
      }),
    );
    // The mapper input type has no field for another chair's member's fee at all — this assertion
    // documents that guarantee: the only "sessionFee" string anywhere in the output is self's own.
    const serialised = JSON.stringify(view);
    const feeOccurrences = serialised.match(/"sessionFee":"[^"]*"|"sessionFee":null/g) ?? [];
    expect(feeOccurrences).toEqual(['"sessionFee":"150.00"']);
  });
});
