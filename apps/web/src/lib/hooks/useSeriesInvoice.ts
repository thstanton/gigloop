import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGetNullable } from '@/lib/api';
import type { SeriesInvoice } from '@/types/api';

export function useSeriesInvoice(seriesId: string | null | undefined) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['seriesInvoice', seriesId],
    queryFn: () => apiGetNullable<SeriesInvoice>(`/series/${seriesId}/invoices/current`),
    enabled: isLoaded && !!seriesId,
  });
}
