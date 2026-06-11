import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { VenueMapWidget } from '@/components/common/VenueMapWidget';
import { useBooking } from '@/lib/hooks/useBooking';
import { apiGet } from '@/lib/api';
import type { TravelTimeResponse, UserProfile } from '@/types/api';

interface BookingVenueMapWidgetProps {
  bookingId: string;
  contactHref: string;
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

  let travelTime: { minutes: number; distanceMetres: number } | null = null;
  if (travelTimeData) {
    travelTime = { minutes: travelTimeData.minutes, distanceMetres: travelTimeData.distanceMetres };
  } else if (venue.travelTimeMinutes != null && venue.travelDistanceMetres != null) {
    travelTime = { minutes: venue.travelTimeMinutes, distanceMetres: venue.travelDistanceMetres };
  }

  return (
    <VenueMapWidget
      venue={venue}
      showHeader={true}
      cardTitle="Venue"
      cardAction={
        <button
          type="button"
          onClick={() => setSearchParams({ sheet: 'contactEdit', contactId: venue.id })}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Edit
        </button>
      }
      contactHref={contactHref}
      travelTime={travelTime}
      isLoadingTravelTime={isFetchingTravelTime}
      onRefreshTravelTime={() => queryClient.invalidateQueries({ queryKey: ['contact-travel-time', venueId] })}
    />
  );
}
