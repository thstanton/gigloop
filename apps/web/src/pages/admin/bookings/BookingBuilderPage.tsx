import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@clerk/react';
import { Button } from '@/components/ui/button';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { MobileBuilderStepper } from '@/features/bookings/MobileBuilderStepper';
import { buildCompletenessMap, deriveBuilderNav } from '@/features/bookings/builderHelpers';
import { useBuilderScroll } from '@/features/bookings/useBuilderScroll';
import { useBookingBuilderQueries } from '@/features/bookings/useBookingBuilderQueries';
import { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';
import { BuilderCompletenessRail } from '@/features/bookings/BuilderCompletenessRail';
import { BuilderExitBackstopDialog } from '@/features/bookings/BuilderExitBackstopDialog';
import { BuilderSpineSections } from '@/features/bookings/BuilderSpineSections';

// PRD #511 Module C — the Booking Builder: a single scrolling one-pager stacking the
// concern atoms in spine order (declared in builderSpine.ts). All atoms run in
// self-saving (Tier-1) regime; row-level operations are immediate-persist (Tier-3).
// The completeness rail derives from the Module A predicates (venueCompleteness,
// peopleCompleteness, itineraryCompleteness) so the rail and the checklist are never
// out of sync. Accessible at /admin/bookings/:id/builder; wired into the global Edit
// action in slice #525.
//
// This page is a thin orchestrator (#992): each concern's composition lives in
// its own <X>Section.tsx (assembled in spine order by BuilderSpineSections),
// mutations in useBookingBuilderMutations, ancillary reads in
// useBookingBuilderQueries, scroll/deep-link wiring in useBuilderScroll. The
// page itself owns only routing and the completeness/exit-backstop derivation.

export default function BookingBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoaded } = useAuth();
  const { data: booking, isLoading, isError } = useBooking(id!);
  const fields = useBookingFields(id!);

  const queries = useBookingBuilderQueries({
    id: id!,
    isLoaded,
    hasMusicFormConfig: booking?.hasMusicFormConfig,
  });

  const { activeId, scrollTo, registerSectionRef } = useBuilderScroll({
    bookingLoaded: !!booking,
    deepLinkSection: searchParams.get('section'),
  });

  const [showBackstop, setShowBackstop] = useState(false);

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
  const { undone, stepperSections } = deriveBuilderNav(completeness);

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
        <BuilderSpineSections
          booking={booking}
          bookingId={id!}
          fields={fields}
          queries={queries}
          mutations={mutations}
          registerSectionRef={registerSectionRef}
          onDone={handleDone}
        />

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
