import { describe, it, expect } from 'vitest';
import { resolveBookingTravelTime } from './BookingVenueMapWidget';

describe('resolveBookingTravelTime', () => {
  const snapshot = { travelTimeMinutes: 40, travelDistanceMetres: 22000 };

  it('prefers a freshly-fetched travel time over the venue snapshot', () => {
    expect(resolveBookingTravelTime({ minutes: 25, distanceMetres: 12300 }, snapshot)).toEqual({
      minutes: 25,
      distanceMetres: 12300,
    });
  });

  it('falls back to the venue snapshot when no fresh time is available', () => {
    expect(resolveBookingTravelTime(null, snapshot)).toEqual({ minutes: 40, distanceMetres: 22000 });
    expect(resolveBookingTravelTime(undefined, snapshot)).toEqual({ minutes: 40, distanceMetres: 22000 });
  });

  it('is null when neither a fresh time nor a complete snapshot exists', () => {
    expect(resolveBookingTravelTime(null, { travelTimeMinutes: null, travelDistanceMetres: null })).toBeNull();
    // A partial snapshot (one half missing) does not count
    expect(resolveBookingTravelTime(null, { travelTimeMinutes: 40, travelDistanceMetres: null })).toBeNull();
  });
});
