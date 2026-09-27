// Shared test-data factories for stories and specs.
//
// A `PackageTemplate` has 13 fields, only 3 of which any given test cares about. Hand-typing the
// other 10 per fixture meant four independent literals that all had to be edited whenever the type
// gained a required field — and they had already drifted apart. One factory, overrides for what the
// test is actually about.
import type { BookingBandMember, BookingDetail, Contact, LineupTemplate, PackageTemplate } from '@/types/api';

export function contact(over: Partial<Contact> & Pick<Contact, 'id' | 'name'>): Contact {
  return {
    createdAt: '2030-01-01T00:00:00Z',
    updatedAt: '2030-01-01T00:00:00Z',
    greetingName: null,
    email: null,
    phone: null,
    notes: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    county: null,
    postcode: null,
    country: null,
    latitude: null,
    longitude: null,
    placeId: null,
    travelTimeMinutes: null,
    travelDistanceMetres: null,
    travelTimeCalculatedAt: null,
    travelMode: null,
    parkingInfo: null,
    accessInfo: null,
    equipmentAvailable: null,
    website: null,
    commissionArrangement: null,
    primaryRole: null,
    primaryBandRole: null,
    instruments: [],
    travelNotes: null,
    equipmentNotes: null,
    outfitNotes: null,
    availabilityNotes: null,
    ...over,
  };
}

export function bookingDetail(over: Partial<BookingDetail> = {}): BookingDetail {
  const customer = over.customer ?? contact({
    id: over.customerId ?? 'contact-customer',
    name: 'Casey Customer',
  });
  return {
    id: 'booking-1',
    createdAt: '2030-01-01T00:00:00Z',
    updatedAt: '2030-01-01T00:00:00Z',
    status: 'CONFIRMED',
    eventType: 'WEDDING',
    date: '2030-06-01T18:00:00Z',
    title: 'Wedding reception',
    fee: null,
    customerId: customer.id,
    customer,
    venueId: null,
    venue: null,
    bookingAgentId: null,
    bookingAgent: null,
    sets: [],
    seriesId: null,
    series: null,
    packages: [],
    activeContract: null,
    portalToken: 'portal-token',
    hasMusicFormConfig: false,
    hasMusicFormResponse: false,
    logistics: null,
    notes: null,
    portalVisibility: { contract: null, musicForm: null },
    band: { lineups: [], chairs: [], members: [] },
    ...over,
  };
}

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
