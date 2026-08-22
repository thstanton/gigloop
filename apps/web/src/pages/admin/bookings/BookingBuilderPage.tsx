import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@clerk/react';
import { Button } from '@/components/ui/button';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { MobileBuilderStepper, type StepperSection } from '@/features/bookings/MobileBuilderStepper';
import type { SpineId } from '@/features/bookings/builderCompleteness';
import { SPINE, SECTION_DOM_IDS } from '@/features/bookings/builderSpine';
import { buildCompletenessMap } from '@/features/bookings/builderHelpers';
import { useScrollSpy } from '@/lib/hooks/useScrollSpy';
import { useBookingBuilderQueries } from '@/features/bookings/useBookingBuilderQueries';
import { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';
import { BuilderCompletenessRail } from '@/features/bookings/BuilderCompletenessRail';
import { BuilderExitBackstopDialog } from '@/features/bookings/BuilderExitBackstopDialog';
import { OverviewSection } from '@/features/bookings/OverviewSection';
import { PeopleSection } from '@/features/bookings/PeopleSection';
import { VenueSection } from '@/features/bookings/VenueSection';
import { TemplatesSection } from '@/features/bookings/TemplatesSection';
import { ItinerarySection } from '@/features/bookings/ItinerarySection';
import { DetailsSection } from '@/features/bookings/DetailsSection';
import { MusicSection } from '@/features/bookings/MusicSection';
import { NotesSection } from '@/features/bookings/NotesSection';

// PRD #511 Module C — the Booking Builder: a single scrolling one-pager stacking the
// concern atoms in spine order (declared in builderSpine.ts). All atoms run in
// self-saving (Tier-1) regime; row-level operations are immediate-persist (Tier-3).
// The completeness rail derives from the Module A predicates (venueCompleteness,
// peopleCompleteness, itineraryCompleteness) so the rail and the checklist are never
// out of sync. Accessible at /admin/bookings/:id/builder; wired into the global Edit
// action in slice #525.
//
// This page is a thin orchestrator (#992): each concern's composition lives in
// its own <X>Section.tsx, mutations in useBookingBuilderMutations, ancillary reads
// in useBookingBuilderQueries. The page owns only routing, scroll/deep-link wiring
// and the completeness/exit-backstop derivation.

export default function BookingBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoaded } = useAuth();
  const { data: booking, isLoading, isError } = useBooking(id!);
  const fields = useBookingFields(id!);

  const { seriesList, templates, templatesLoading, musicConfig, musicConfigLoading } = useBookingBuilderQueries({
    id: id!,
    isLoaded,
    hasMusicFormConfig: booking?.hasMusicFormConfig,
  });

  // One ref map + a stable per-id callback built once, rather than a per-section
  // useRef declared solely to satisfy the Rules of Hooks (#992).
  const sectionRefs = useRef<Partial<Record<SpineId, HTMLElement>>>({});
  const registerSectionRef = useMemo(() => {
    const map = {} as Record<SpineId, React.RefCallback<HTMLElement>>;
    for (const { id: sectionId } of SPINE) {
      map[sectionId] = (el) => { sectionRefs.current[sectionId] = el ?? undefined; };
    }
    return map;
  }, []);

  // Mobile stepper: active node tracks scroll position, and jumps set it eagerly
  // so the highlight moves the instant a node is tapped (ADR-0051).
  const [activeId, setActiveId] = useState<SpineId>('overview');
  useScrollSpy(SECTION_DOM_IDS, (domId) => setActiveId(domId.replace('builder-', '') as SpineId));

  const [showBackstop, setShowBackstop] = useState(false);

  function scrollTo(sectionId: SpineId) {
    setActiveId(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Deep-link into a step (?section=…): the checklist's structural items and the
  // Itinerary-card "apply a template" affordance land here (slice #525). Fires once,
  // after the booking (and therefore the sections) have mounted. Scrolls via the
  // stable DOM id so the only deps are primitives (no unstable scrollTo/refs).
  const didDeepLink = useRef(false);
  const deepLinkSection = searchParams.get('section');
  const bookingLoaded = !!booking;
  useEffect(() => {
    if (didDeepLink.current || !bookingLoaded || !deepLinkSection) return;
    if (!SPINE.some((s) => s.id === deepLinkSection)) return;
    didDeepLink.current = true;
    setActiveId(deepLinkSection as SpineId);
    const el = document.getElementById(`builder-${deepLinkSection}`);
    requestAnimationFrame(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [bookingLoaded, deepLinkSection]);

  const mutations = useBookingBuilderMutations({ id: id!, booking });

  // ── Loading / error guards ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-4 w-20 bg-border rounded" />
        <div className="h-6 w-40 bg-border rounded" />
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 bg-border rounded-lg" />)}
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="px-4 md:px-6 py-6">
        <p className="text-sm text-muted">Booking not found.</p>
        <Link to="/admin/bookings" className="text-sm text-primary underline underline-offset-2 mt-2 block">
          Back to bookings
        </Link>
      </div>
    );
  }

  // ── Completeness (derived from current booking data for rail + backstop) ────

  const completeness = buildCompletenessMap(booking);
  const undone = SPINE.filter(({ id: sid }) => {
    const s = completeness[sid];
    return s === 'unset' || s === 'empty';
  });
  const stepperSections: StepperSection[] = SPINE.map(({ id: sid, label }) => ({
    id: sid,
    label,
    status: completeness[sid],
  }));

  function handleDone() {
    if (undone.length > 0) setShowBackstop(true);
    else navigate(`/admin/bookings/${id}`);
  }

  return (
    <>
      {/* Mobile ambient progress (ADR-0051): fixed below the top bar, full screen
          width, visible throughout editing. Fixed (not sticky) so it never lifts
          off at the page end. Portalled to <body> — like the AppShell bars — so no
          page-subtree ancestor can scope its fixed positioning. md:hidden keeps it
          off desktop, which uses the vertical rail. */}
      {createPortal(
        <div className="fixed top-14 inset-x-0 z-20 md:hidden">
          <MobileBuilderStepper sections={stepperSections} activeId={activeId} onJump={scrollTo} />
        </div>,
        document.body,
      )}

      {/* pt-24 on mobile reserves room for the fixed stepper; desktop just py-6. */}
      <div className="px-4 md:px-6 pt-24 pb-6 md:py-6 max-w-7xl mx-auto">
        <Link
          to={`/admin/bookings/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          Back to booking
        </Link>

        <h1 className="mt-4 mb-6 font-display text-2xl font-semibold text-foreground">
          Booking Builder
        </h1>

        <div className="md:grid md:grid-cols-[1fr_220px] md:gap-8 md:items-start">
        {/* ── Spine ─────────────────────────────────────────────────────────── */}
        <div className="space-y-8">
          <OverviewSection
            booking={booking}
            bookingId={id!}
            seriesList={seriesList}
            mutations={mutations}
            refCallback={registerSectionRef.overview}
          />
          <PeopleSection
            booking={booking}
            bookingId={id!}
            peopleSave={mutations.peopleSave}
            refCallback={registerSectionRef.people}
          />
          <VenueSection
            booking={booking}
            bookingId={id!}
            venueSave={mutations.venueSave}
            refCallback={registerSectionRef.venue}
          />
          <TemplatesSection
            booking={booking}
            templates={templates}
            templatesLoading={templatesLoading}
            mutations={mutations}
            refCallback={registerSectionRef.templates}
          />
          <ItinerarySection
            booking={booking}
            bookingId={id!}
            templates={templates}
            templatesLoading={templatesLoading}
            mutations={mutations}
            refCallback={registerSectionRef.itinerary}
          />
          <DetailsSection
            booking={booking}
            detailsSave={mutations.detailsSave}
            refCallback={registerSectionRef.details}
          />
          <MusicSection
            booking={booking}
            bookingId={id!}
            musicConfig={musicConfig}
            musicConfigLoading={musicConfigLoading}
            mutations={mutations}
            refCallback={registerSectionRef.music}
          />
          <NotesSection
            booking={booking}
            onSaveNotes={(notes) => fields.updateNotes(notes)}
            isNotesPending={fields.isNotesPending}
            refCallback={registerSectionRef.notes}
          />

          {/* Mobile Done button */}
          <div className="flex justify-end pb-8 md:hidden">
            <Button onClick={handleDone}>Done</Button>
          </div>
        </div>

        {/* ── Completeness rail (desktop only) ─────────────────────────────── */}
        <aside className="hidden md:block sticky top-20">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Sections</p>
          <BuilderCompletenessRail completeness={completeness} onScrollTo={scrollTo} />
          <div className="mt-6">
            <Button className="w-full" onClick={handleDone}>Done</Button>
          </div>
        </aside>
      </div>

      <BuilderExitBackstopDialog
        open={showBackstop}
        undone={undone}
        onScrollTo={scrollTo}
        onClose={() => setShowBackstop(false)}
        onExit={() => navigate(`/admin/bookings/${id}`)}
      />
      </div>
    </>
  );
}
