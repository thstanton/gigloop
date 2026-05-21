import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { ContactDetail } from '@/types/api';

export function useContact(id: string) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['contact', id],
    queryFn: () => apiGet<ContactDetail>(`/contacts/${id}`),
    enabled: isLoaded && !!id,
  });
}
