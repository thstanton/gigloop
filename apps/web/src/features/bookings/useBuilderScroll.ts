import { useEffect, useMemo, useRef, useState } from 'react';
import { useScrollSpy } from '@/lib/hooks/useScrollSpy';
import { SPINE, SECTION_DOM_IDS } from '@/features/bookings/builderSpine';
import type { SpineId } from '@/features/bookings/builderCompleteness';

// Everything the Booking Builder page needs to track "which section is the
// user looking at, and how do we get them to another one" — the section ref
// registry, the mobile scroll-spy, and the ?section=… deep-link (the
// checklist's structural items and the Itinerary-card "apply a template"
// affordance land here, slice #525). Split out of BookingBuilderPage (#992)
// so the page's own render body stays about routing and composition, not
// scroll mechanics.
export function useBuilderScroll({
  bookingLoaded,
  deepLinkSection,
}: {
  bookingLoaded: boolean;
  deepLinkSection: string | null;
}) {
  // One ref map + a stable per-id callback built once, rather than a per-section
  // useRef declared solely to satisfy the Rules of Hooks.
  const sectionRefs = useRef<Partial<Record<SpineId, HTMLElement>>>({});
  const registerSectionRef = useMemo(() => {
    const map = {} as Record<SpineId, React.RefCallback<HTMLElement>>;
    for (const { id: sectionId } of SPINE) {
      map[sectionId] = (el) => { sectionRefs.current[sectionId] = el ?? undefined; };
    }
    return map;
  }, []);

  // Active node tracks scroll position, and jumps set it eagerly so the
  // highlight moves the instant a node is tapped (ADR-0051).
  const [activeId, setActiveId] = useState<SpineId>('overview');
  useScrollSpy(SECTION_DOM_IDS, (domId) => setActiveId(domId.replace('builder-', '') as SpineId));

  function scrollTo(sectionId: SpineId) {
    setActiveId(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Fires once, after the booking (and therefore the sections) have mounted.
  // Scrolls via the stable DOM id so the only deps are primitives (no
  // unstable scrollTo/refs).
  const didDeepLink = useRef(false);
  useEffect(() => {
    if (didDeepLink.current || !bookingLoaded || !deepLinkSection) return;
    if (!SPINE.some((s) => s.id === deepLinkSection)) return;
    didDeepLink.current = true;
    setActiveId(deepLinkSection as SpineId);
    const el = document.getElementById(`builder-${deepLinkSection}`);
    requestAnimationFrame(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [bookingLoaded, deepLinkSection]);

  return { activeId, scrollTo, registerSectionRef };
}
