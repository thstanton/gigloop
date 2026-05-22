import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { Template } from '@/types/api';

export function useTemplate(id: string) {
  const { isLoaded } = useAuth();
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => apiGet<Template>(`/templates/${id}`),
    enabled: isLoaded && !!id,
  });
}
