import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '@/lib/api';
import type { BookingDetail, MusicFormConfig } from '@/types/api';

function buildSeedPayload(booking: BookingDetail) {
  const keyMoments = (booking.packages ?? []).flatMap((bpf) =>
    bpf.package.keyMoments.map((km) => ({ label: km, section: bpf.package.label })),
  );
  const enabledGenres = [...new Set((booking.packages ?? []).flatMap((bpf) => bpf.package.defaultGenreSelection))];
  return { keyMoments, enabledGenres };
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
