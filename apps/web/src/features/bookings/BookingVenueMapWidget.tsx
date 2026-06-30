import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { VenueMapWidget } from '@/components/common/VenueMapWidget';
import { GhostButton } from '@/components/common/GhostButton';
import { useBooking } from '@/lib/hooks/useBooking';
import { apiGet } from '@/lib/api';
import type { TravelTimeResponse, UserProfile } from '@/types/api';

interface BookingVenueMapWidgetProps {
  bookingId: string;
  contactHref: string;
}

// Prefer a freshly-fetched travel time; otherwise fall back to the value snapshotted on the
// venue contact. Returns null when neither is available. Pure so it can be unit-tested.
export function resolveBookingTravelTime(
  travelTimeData: { minutes: number; distanceMetres: number } | null | undefined,
  venue: { travelTimeMinutes: number | null; travelDistanceMetres: number | null },
): { minutes: number; distanceMetres: number } | null {
  if (travelTimeData) {
    return { minutes: travelTimeData.minutes, distanceMetres: travelTimeData.distanceMetres };
  }
  if (venue.travelTimeMinutes != null && venue.travelDistanceMetres != null) {
    return { minutes: venue.travelTimeMinutes, distanceMetres: venue.travelDistanceMetres };
  }
  return null;
}

export function BookingVenueMapWidget({ bookingId, contactHref }: BookingVenueMapWidgetProps) {
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: booking } = useBooking(bookingId);
  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
  });

  const venueId = booking?.venue?.id;
  const hasVenueCoords = !!booking?.venue?.latitude && !!booking?.venue?.longitude;
  const hasHomeCoords = !!userProfile?.latitude && !!userProfile?.longitude;

  const { data: travelTimeData, isFetching: isFetchingTravelTime } = useQuery({
    queryKey: ['contact-travel-time', venueId],
    queryFn: () => apiGet<TravelTimeResponse>(`/contacts/${venueId}/travel-time`),
    enabled: !!venueId && hasVenueCoords && hasHomeCoords,
  });

  if (!booking?.venue) return null;

  const venue = booking.venue;
  const travelTime = resolveBookingTravelTime(travelTimeData, venue);

  return (
    <VenueMapWidget
      venue={venue}
      showHeader={true}
      cardTitle="Venue"
      cardAction={
        <GhostButton
          variant="primary"
          size="xs"
          icon={<Pencil size={13} />}
          onClick={() => setSearchParams({ sheet: 'venueTweak' })}
        >
          Edit
        </GhostButton>
      }
      contactHref={contactHref}
      travelTime={travelTime}
      isLoadingTravelTime={isFetchingTravelTime}
      homeAddressMissing={hasVenueCoords && !hasHomeCoords}
      onRefreshTravelTime={() => queryClient.invalidateQueries({ queryKey: ['contact-travel-time', venueId] })}
    />
  );
}
