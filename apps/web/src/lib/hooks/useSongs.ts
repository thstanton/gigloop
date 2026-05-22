import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { Song } from '@/types/api';

export function useSongs() {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['songs'],
    queryFn: () => apiGet<Song[]>('/songs'),
    enabled: isLoaded,
  });
}
