import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import type { UserProfile } from '@/types/api';

/**
 * One dismissal mechanism for all teaching surfaces (tips + concept cards).
 * Reads/writes `preferences.dismissedHints` off the shared `['me']` query, so a
 * dismissal persists across sessions and devices. Tier-3 optimistic: the cache
 * updates immediately and rolls back with an error toast on failure.
 */
export function useDismissibleHint(id: string) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const isDismissed = me?.preferences?.dismissedHints?.includes(id) ?? false;

  const dismissMutation = useMutation({
    mutationFn: () => {
      const current = queryClient.getQueryData<UserProfile>(['me'])?.preferences?.dismissedHints ?? [];
      const next = [...new Set([...current, id])];
      // Server shallow-merges at the `preferences` key, so send the full array.
      return apiPatch('/me', { preferences: { dismissedHints: next } });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['me'] });
      const previous = queryClient.getQueryData<UserProfile>(['me']);
      if (previous) {
        const next = [...new Set([...(previous.preferences?.dismissedHints ?? []), id])];
        queryClient.setQueryData<UserProfile>(['me'], {
          ...previous,
          preferences: { ...previous.preferences, dismissedHints: next },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['me'], context.previous);
      toast({ title: 'Couldn’t save that. Please try again.', variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  return { isDismissed, dismiss: () => dismissMutation.mutate() };
}
