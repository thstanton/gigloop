import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '@/lib/api';
import type { BookingDetail, MusicFormConfig } from '@/types/api';

function buildSeedPayload(_booking: BookingDetail) {
  // #502 restores template-derived key-moment/genre suggestion. ADR-0046 severs the
  // booking-owned Package → PackageTemplate provenance, so the snapshot no longer
  // carries keyMoments/defaultGenreSelection to seed from.
  return { keyMoments: [], enabledGenres: [] };
}

export function useConfigureMusicForm(
  bookingId: string,
  booking: BookingDetail | undefined,
  onSuccess: () => void,
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      if (!booking) return Promise.reject(new Error('No booking'));
      return apiPut<MusicFormConfig>(`/bookings/${bookingId}/music-form-config`, buildSeedPayload(booking));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      onSuccess();
    },
  });

  return mutation;
}
