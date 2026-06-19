import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPut } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { BookingDetail, MusicFormConfig } from '@/types/api';

export function useConfigureMusicForm(
  bookingId: string,
  booking: BookingDetail | undefined,
  onSuccess: () => void,
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      if (!booking) return Promise.reject(new Error('No booking'));
      // Turning the form on starts empty (ADR-0046 / #502): provenance is severed,
      // so there is nothing to seed from. Moments are added in the editor, or
      // suggested when a Package Template is applied.
      return apiPut<MusicFormConfig>(`/bookings/${bookingId}/music-form-config`, {
        keyMoments: [],
        enabledGenres: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      onSuccess();
    },
    onError: () => toast({ title: 'Failed to turn on the music form. Please try again.', variant: 'destructive' }),
  });

  return mutation;
}
