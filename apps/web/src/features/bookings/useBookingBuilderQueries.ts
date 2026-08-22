import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { BookingSeries, MusicFormConfig, PackageTemplate } from '@/types/api';

// The Booking Builder's ancillary reads — series (for Overview), package
// templates (for the Package Templates + Itinerary sections) and the music
// form config (for the Music section). Split out from useBooking/useBookingFields
// because these aren't the booking itself, just data the builder's sections need.
export function useBookingBuilderQueries({
  id,
  isLoaded,
  hasMusicFormConfig,
}: {
  id: string;
  isLoaded: boolean;
  hasMusicFormConfig: boolean | undefined;
}) {
  const { data: seriesList = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => apiGet<BookingSeries[]>('/series'),
    enabled: isLoaded,
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<PackageTemplate[]>('/packages'),
    enabled: isLoaded,
  });

  const { data: musicConfig = null, isLoading: musicConfigLoading } = useQuery({
    queryKey: ['booking-music-form-config', id],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${id}/music-form-config`),
    enabled: isLoaded && hasMusicFormConfig,
  });

  return { seriesList, templates, templatesLoading, musicConfig, musicConfigLoading };
}
