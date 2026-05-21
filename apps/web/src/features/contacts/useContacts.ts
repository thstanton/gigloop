import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { Contact } from '@/types/api';

export function useContacts() {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['contacts'],
    queryFn: () => apiGet<Contact[]>('/contacts'),
    enabled: isLoaded,
  });
}
