// Band roster — chair-picker ranking (#886, ADR-0072 §3/§4). Roles and instruments are free text
// sharing one soft-matched vocabulary; a hard filter breaks on "Sax" vs "Saxophone", so matching
// is substring-based, not exact. Proximity is haversine at query time, dep ↔ venue — a ranking
// aid, never a hard filter: missing coordinates degrade silently rather than dropping anyone.

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export interface GeoPoint {
  latitude: number | null;
  longitude: number | null;
}

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Case-insensitive substring match, either direction — "Sax" matches "Saxophone" and vice versa. */
export function softMatchesRole(value: string, role: string): boolean {
  const a = value.trim().toLowerCase();
  const b = role.trim().toLowerCase();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export interface RosterCandidate extends GeoPoint {
  id: string;
  primaryBandRole: string | null;
  instruments: string[];
}

export function contactMatchesChairRole(contact: Pick<RosterCandidate, 'primaryBandRole' | 'instruments'>, chairRole: string): boolean {
  if (!chairRole.trim()) return false;
  if (contact.primaryBandRole && softMatchesRole(contact.primaryBandRole, chairRole)) return true;
  return contact.instruments.some((instrument) => softMatchesRole(instrument, chairRole));
}

function distanceTo(venue: { latitude: number; longitude: number } | null, contact: GeoPoint): number | null {
  if (!venue || contact.latitude == null || contact.longitude == null) return null;
  return haversineKm(venue, { latitude: contact.latitude, longitude: contact.longitude });
}

/**
 * Ranks contacts for filling a chair: soft role/instrument match first, then haversine distance
 * to the venue when both have coordinates. Stable otherwise (preserves the incoming order, e.g.
 * alphabetical) — never filters anyone out.
 */
export function rankContactsForChair<T extends RosterCandidate>(
  contacts: T[],
  chairRole: string,
  venue: GeoPoint | null | undefined,
): T[] {
  const venuePoint =
    venue && venue.latitude != null && venue.longitude != null
      ? { latitude: venue.latitude, longitude: venue.longitude }
      : null;

  return [...contacts].sort((a, b) => {
    const aMatch = contactMatchesChairRole(a, chairRole) ? 0 : 1;
    const bMatch = contactMatchesChairRole(b, chairRole) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;

    const aDist = distanceTo(venuePoint, a);
    const bDist = distanceTo(venuePoint, b);
    if (aDist === null && bDist === null) return 0;
    if (aDist === null) return 1;
    if (bDist === null) return -1;
    return aDist - bDist;
  });
}
