import { useCallback, useRef } from 'react';

export function useFocusReturn() {
  const ref = useRef<Element | null>(null);
  const capture = useCallback(() => { ref.current = document.activeElement; }, []);
  const restore = useCallback(() => { (ref.current as HTMLElement | null)?.focus(); }, []);
  return { capture, restore };
}
