// Shared test-data factories for stories and specs.
//
// A `PackageTemplate` has 13 fields, only 3 of which any given test cares about. Hand-typing the
// other 10 per fixture meant four independent literals that all had to be edited whenever the type
// gained a required field — and they had already drifted apart. One factory, overrides for what the
// test is actually about.
import type { BookingBandMember, LineupTemplate, PackageTemplate } from '@/types/api';

export function packageTemplate(
  over: Partial<PackageTemplate> & { id: string; label: string },
): PackageTemplate {
  return {
    createdAt: '2030-01-01T00:00:00Z',
    updatedAt: '2030-01-01T00:00:00Z',
    category: null,
    icon: 'music',
    keyMoments: [],
    defaultGenreSelection: [],
    notes: null,
    isSystemDefault: false,
    enabled: true,
    defaultLineupTemplateId: null,
    slots: [{ id: `${over.id}-s1`, label: 'Set 1', duration: 45, order: 0 }],
    ...over,
  };
}

export function lineupTemplate(
  over: Partial<LineupTemplate> & { id: string; label: string },
): LineupTemplate {
  return {
    createdAt: '2030-01-01T00:00:00Z',
    updatedAt: '2030-01-01T00:00:00Z',
    slots: [{ id: `${over.id}-s1`, role: 'Vocals', order: 0 }],
    ...over,
  };
}

export function bandMember(
  over: Partial<BookingBandMember> & { id: string; contactId: string; contact: BookingBandMember['contact'] },
): BookingBandMember {
  return {
    bandPortalToken: `${over.id}-token`,
    status: 'ADDED',
    isSelf: false,
    sessionFee: null,
    invitedAt: null,
    respondedAt: null,
    ...over,
  };
}
