import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGetNullable } from '@/lib/api';
import type { Invoice } from '@/types/api';

export function useSeriesInvoice(seriesId: string | null | undefined) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['seriesInvoice', seriesId],
    queryFn: () => apiGetNullable<Invoice>(`/series/${seriesId}/invoices/current`),
    enabled: isLoaded && !!seriesId,
  });
}
