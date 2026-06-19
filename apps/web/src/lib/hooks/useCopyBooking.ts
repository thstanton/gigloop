import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';

/**
 * Copy Event (#507 / ADR-0049): duplicates the booking server-side into the same series on
 * a new date, then navigates to the freshly created booking. Tier-2 mutation — failure
 * surfaces as a toast.
 */
export function useCopyBooking(bookingId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (date: string) => apiPost<{ id: string }>(`/bookings/${bookingId}/copy`, { date }),
    onSuccess: (created) => {
      // The copy joins the same series and adds to the bookings list — refresh both, then
      // open the new booking so the musician lands on the gig they just created.
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      navigate(`/admin/bookings/${created.id}`);
    },
    onError: () =>
      toast({ title: 'Could not repeat this booking — please try again', variant: 'destructive' }),
  });

  return {
    copyBooking: (date: string) => mutation.mutate(date),
    isPending: mutation.isPending,
  };
}
