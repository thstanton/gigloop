// The nested-contact shape every booking read/write nests for customer/venue/bookingAgent
// (ADR-0071 / #873): mirrors `ContactResponseDto` field-for-field, `userId` excluded. `ContactResponseDto`
// already omits `userId` for the same reason, so this is the correct nested shape for bookings too —
// no new DTO needed.
export const NESTED_CONTACT_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  greetingName: true,
  email: true,
  phone: true,
  notes: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  county: true,
  postcode: true,
  country: true,
  latitude: true,
  longitude: true,
  placeId: true,
  travelTimeMinutes: true,
  travelDistanceMetres: true,
  travelTimeCalculatedAt: true,
  travelMode: true,
  parkingInfo: true,
  accessInfo: true,
  equipmentAvailable: true,
  website: true,
  commissionArrangement: true,
  primaryRole: true,
} as const;

// The booking's most recent contract, narrowed to exactly what `BookingActiveContractDto` declares
// (ADR-0071 / #873) — `normaliseContract` never reads more than this. Shared with the portal query
// (portal.repository.ts), which also only reads id/status/content/signedAt off a contract.
export const CONTRACT_INCLUDE = {
  select: {
    id: true,
    createdAt: true,
    updatedAt: true,
    status: true,
    content: true,
    signedAt: true,
  },
  orderBy: { createdAt: 'desc' as const },
  take: 1,
} as const;
