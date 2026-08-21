import { useId } from 'react';

// An <input list> id is resolved via a literal DOM lookup that chokes on the colons React's
// useId() produces (e.g. happy-dom's querySelector-based <input list> implementation) — plain
// alphanumerics only.
export function useDatalistId(): string {
  return useId().replace(/:/g, '');
}
