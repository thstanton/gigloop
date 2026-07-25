import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import type { SearchResult } from '@/types/api';

/** Below this the tokenizer (ADR-0041, 2-char minimum) has nothing to match, so we don't call. */
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

/**
 * Debounced palette search against `GET /search?q=` (ADR-0067 §2). Fires only once typing settles
 * and the term clears the tokenizer's minimum, gated on Clerk being loaded. The term is in the
 * query key so TanStack Query caches per term and refetches when it changes.
 */
export function useSearch(query: string) {
  const { isLoaded } = useAuth();
  const term = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const enabled = isLoaded && term.length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: ['search', term],
    queryFn: () => apiGet<SearchResult[]>(`/search?q=${encodeURIComponent(term)}`),
    enabled,
  });

  return {
    results: data ?? [],
    isLoading: enabled && isFetching,
  };
}
