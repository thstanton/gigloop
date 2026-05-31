import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { UserProfile } from '@/types/api';

export function useMe() {
  const { isLoaded, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded && !!isSignedIn,
  });
}
