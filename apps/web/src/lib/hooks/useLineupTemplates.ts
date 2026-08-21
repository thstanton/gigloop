import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { LineupTemplate } from '@/types/api';

// Shared by the Band sheet (the picker) and the Band card (#887's "has a multi-person lineup"
// empty-state signal, ADR-0073 §6) — one query key, so both share the cache instead of each
// firing its own request for the same data.
export function useLineupTemplates(enabled = true) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['lineups'],
    queryFn: () => apiGet<LineupTemplate[]>('/lineups'),
    enabled: isLoaded && enabled,
  });
}
