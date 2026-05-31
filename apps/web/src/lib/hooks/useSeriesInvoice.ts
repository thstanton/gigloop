import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { SeriesInvoice } from '@/types/api';

export function useSeriesInvoice(seriesId: string | null | undefined) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['seriesInvoice', seriesId],
    queryFn: () => apiGet<SeriesInvoice | null>(`/series/${seriesId}/invoices/current`),
    enabled: isLoaded && !!seriesId,
  });
}
