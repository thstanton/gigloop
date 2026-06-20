import { useEffect, useRef } from 'react';

// Scroll-spy: observes the given element ids and reports whichever is currently
// nearest the top of the viewport via `onActive`. Drives the Booking Builder
// mobile stepper's active node from scroll position (ADR-0051). The caller owns
// the active-id state, so it can also set it eagerly on a jump (immediate
// feedback) and let the spy keep it in sync as the page settles.
//
// `onActive` is held in a ref so the observer isn't torn down when the callback
// identity changes; pass a stable (module-level or memoised) `elementIds` array.
export function useScrollSpy(
  elementIds: string[],
  onActive: (id: string) => void,
  rootMargin = '-10% 0px -75% 0px',
): void {
  const onActiveRef = useRef(onActive);
  onActiveRef.current = onActive;

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const elements = elementIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        let topmost = visible[0];
        for (const entry of visible) {
          if (entry.boundingClientRect.top < topmost.boundingClientRect.top) topmost = entry;
        }
        onActiveRef.current(topmost.target.id);
      },
      { rootMargin, threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [elementIds, rootMargin]);
}
