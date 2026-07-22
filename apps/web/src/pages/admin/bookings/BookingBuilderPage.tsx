import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  ChevronLeft,
  FileText,
  ListOrdered,
  MapPin,
  Music,
  Package,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { OverviewAtom, type OverviewChanges, type SeriesChange } from '@/features/bookings/OverviewAtom';
import { PeopleAtom, type PeopleSelection } from '@/features/bookings/PeopleAtom';
import { VenueAtom, type VenueSelection } from '@/features/bookings/VenueAtom';
import { RemindMeAboutContainer } from '@/features/bookings/RemindMeAboutContainer';
import { DetailsAtom, type DetailsLogistics } from '@/features/bookings/DetailsAtom';
import { LOGISTICS_TIME_KEYS } from '@/lib/constants';
import { ItineraryAtom } from '@/features/bookings/ItineraryAtom';
import { MusicAtom } from '@/features/bookings/MusicAtom';
import { MobileBuilderStepper, type StepperSection } from '@/features/bookings/MobileBuilderStepper';
import {
  CompletenessStatusIcon,
  type CompletenessStatus,
  type SpineId,
} from '@/features/bookings/builderCompleteness';
import { useScrollSpy } from '@/lib/hooks/useScrollSpy';
import InlineNotes from '@/features/bookings/InlineNotes';
import { NO_PACKAGE } from '@/features/bookings/ItineraryFields';
import { useItineraryMutations } from '@/features/bookings/useItineraryMutations';
import { PackagePicker } from '@/features/bookings/PackagePicker';
import { DEFAULT_ENABLED_GENRES } from '@/lib/constants';
import type {
  ApplyPackageTemplateResponse,
  BookingDetail,
  BookingLogisticsEntry,
  BookingSeries,
  Contact,
  KeyMoment,
  MusicFormConfig,
  MusicFormSuggestion,
  PackageTemplate,
  UpdateBookingSeriesResponse,
} from '@/types/api';

// PRD #511 Module C — the Booking Builder: a single scrolling one-pager stacking the
// concern atoms in spine order. All atoms run in self-saving (Tier-1) regime; row-level
// operations are immediate-persist (Tier-3). The completeness rail derives from the
// Module A predicates (venueCompleteness, peopleCompleteness, itineraryCompleteness)
// so the rail and the checklist are never out of sync. Accessible at
// /admin/bookings/:id/builder; wired into the global Edit action in slice #525.

// ─── Spine definition ─────────────────────────────────────────────────────────

const SPINE: Array<{ id: SpineId; label: string; Icon: LucideIcon }> = [
  { id: 'overview',   label: 'Overview',          Icon: CalendarClock },
  { id: 'people',     label: 'People',             Icon: Users },
  { id: 'venue',      label: 'Venue',              Icon: MapPin },
  { id: 'templates',  label: 'Package Templates',  Icon: Package },
  { id: 'itinerary',  label: 'Itinerary',          Icon: ListOrdered },
  { id: 'details',    label: 'Details',            Icon: FileText },
  { id: 'music',      label: 'Music',              Icon: Music },
  { id: 'notes',      label: 'Notes',              Icon: StickyNote },
];

// Stable element-id list for the scroll-spy (module-level so the observer isn't
// rebuilt each render). Mirrors the BuilderSection `id={`builder-${id}`}`.
const SECTION_DOM_IDS = SPINE.map(({ id }) => `builder-${id}`);

// ─── Completeness helpers (mirror Module A predicates client-side) ────────────

function itineraryStatus(setCount: number, hasAllAnchors: boolean): CompletenessStatus {
  if (setCount === 0) return 'empty';
  return hasAllAnchors ? 'set' : 'partial';
}

function buildCompletenessMap(booking: BookingDetail): Record<SpineId, CompletenessStatus> {
  const hasAllAnchors = (['arrivalTime', 'soundCheckTime', 'finishTime'] as const)
    .every((k) => !!booking.logistics?.[k]?.value);
  return {
    overview:   null,
    people:     booking.customer ? 'set' : 'unset',
    venue:      booking.venue ? 'set' : 'unset',
    templates:  null,
    itinerary:  itineraryStatus(booking.sets.length, hasAllAnchors),
    details:    null,
    music:      null,
    notes:      null,
  };
}

// ─── Completeness rail ────────────────────────────────────────────────────────

function CompletenessRail({
  completeness,
  onScrollTo,
}: {
  completeness: Record<SpineId, CompletenessStatus>;
  onScrollTo: (id: SpineId) => void;
}): React.JSX.Element {
  return (
    <nav aria-label="Builder sections" className="space-y-1">
      {SPINE.map(({ id, label, Icon }) => {
        const status = completeness[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onScrollTo(id)}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-accent hover:text-foreground"
          >
            <Icon size={14} className="flex-shrink-0 text-muted" aria-hidden="true" />
            <span className="flex-1 text-left">{label}</span>
            <CompletenessStatusIcon status={status} />
          </button>
        );
      })}
    </nav>
  );
}

// ─── Exit-backstop dialog ─────────────────────────────────────────────────────

function ExitBackstopDialog({
  open,
  undone,
  onScrollTo,
  onClose,
  onExit,
}: {
  open: boolean;
  undone: Array<{ id: SpineId; label: string }>;
  onScrollTo: (id: SpineId) => void;
  onClose: () => void;
  onExit: () => void;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>A few things still need setting up</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogDescription className="mt-2">
          These sections are still empty. You can set them up now or come back later.
        </ResponsiveDialogDescription>
        <ul className="mt-4 space-y-2">
          {undone.map(({ id, label }) => (
            <li key={id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <span className="text-sm font-medium text-foreground">{label}</span>
              <Button size="sm" variant="outline" onClick={() => { onClose(); onScrollTo(id); }}>
                Set up
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Keep editing</Button>
          <Button onClick={onExit}>Exit anyway</Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ─── Builder section wrapper ──────────────────────────────────────────────────

function BuilderSection({
  id,
  title,
  sectionRef,
  children,
}: {
  id: SpineId;
  title: string;
  sectionRef?: React.RefObject<HTMLElement>;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`builder-${id}`}
      ref={sectionRef}
      // Mobile clears the fixed top bar (h-14) + the fixed stepper; desktop just the bar.
      className="scroll-mt-36 md:scroll-mt-8"
    >
      <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
      <div className="rounded-lg border border-border bg-background p-4">
        {children}
      </div>
    </section>
  );
}

// ─── Shared logistics helpers (mirror QuickTweakSheet seams) ─────────────────

function nonAnchorKeys(logistics: BookingDetail['logistics']): Record<string, BookingLogisticsEntry> {
  const anchors = new Set<string>(LOGISTICS_TIME_KEYS);
  return Object.fromEntries(Object.entries(logistics ?? {}).filter(([k]) => !anchors.has(k)));
}

function preservedTimeKeys(logistics: BookingDetail['logistics']): DetailsLogistics {
  const out: DetailsLogistics = {};
  for (const key of LOGISTICS_TIME_KEYS) {
    const entry = logistics?.[key];
    if (entry) out[key] = entry;
  }
  return out;
}

function pluralPackages(n: number): string {
  return `${n} ${n === 1 ? 'package' : 'packages'}`;
}

function isConfirmationRequired(r: unknown): r is Required<UpdateBookingSeriesResponse> {
  return Boolean(r && typeof r === 'object' && 'requiresConfirmation' in r);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const { data: booking, isLoading, isError } = useBooking(id!);
  const fields = useBookingFields(id!);

  // Section scroll refs (individual declarations to satisfy the Rules of Hooks).
  const overviewRef   = useRef<HTMLElement>(null);
  const peopleRef     = useRef<HTMLElement>(null);
  const venueRef      = useRef<HTMLElement>(null);
  const templatesRef  = useRef<HTMLElement>(null);
  const itineraryRef  = useRef<HTMLElement>(null);
  const detailsRef    = useRef<HTMLElement>(null);
  const musicRef      = useRef<HTMLElement>(null);
  const notesRef      = useRef<HTMLElement>(null);

  const sectionRefs: Record<SpineId, React.RefObject<HTMLElement>> = {
    overview:   overviewRef,
    people:     peopleRef,
    venue:      venueRef,
    templates:  templatesRef,
    itinerary:  itineraryRef,
    details:    detailsRef,
    music:      musicRef,
    notes:      notesRef,
  };

  // Mobile stepper: active node tracks scroll position, and jumps set it eagerly
  // so the highlight moves the instant a node is tapped (ADR-0051).
  const [activeId, setActiveId] = useState<SpineId>('overview');
  useScrollSpy(SECTION_DOM_IDS, (domId) => setActiveId(domId.replace('builder-', '') as SpineId));

  const [showBackstop, setShowBackstop] = useState(false);
  const [seriesConfirmation, setSeriesConfirmation] = useState<{ seriesId: string; warning: string } | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<MusicFormSuggestion | null>(null);
  // Package Templates step (#546): templates are STAGED, then applied together via one deliberate
  // action — no blind one-click apply (the apply is destructive: it creates Packages + Sets).
  const [stagedTemplateIds, setStagedTemplateIds] = useState<string[]>([]);

  const { data: seriesList = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => apiGet<BookingSeries[]>('/series'),
    enabled: isLoaded,
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<PackageTemplate[]>('/packages'),
    enabled: isLoaded,
  });

  const { data: musicConfig = null, isLoading: musicConfigLoading } = useQuery({
    queryKey: ['booking-music-form-config', id],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${id}/music-form-config`),
    enabled: isLoaded && booking?.hasMusicFormConfig,
  });

  function invalidateBooking() {
    queryClient.invalidateQueries({ queryKey: ['booking', id!] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  }

  function scrollTo(sectionId: SpineId) {
    setActiveId(sectionId);
    sectionRefs[sectionId].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // ── Overview mutations ─────────────────────────────────────────────────────

  const overviewSave = useMutation({
    mutationFn: (changes: Omit<OverviewChanges, 'series'>) => apiPatch(`/bookings/${id}`, changes),
    onSuccess: invalidateBooking,
    onError: () => {},
  });

  const seriesSave = useMutation({
    mutationFn: (payload: { seriesId?: string | null; newSeriesLabel?: string; confirm?: boolean }) =>
      apiPatch<UpdateBookingSeriesResponse | object>(`/bookings/${id}/series`, payload),
    onSuccess: (result, vars) => {
      if (isConfirmationRequired(result)) {
        setSeriesConfirmation({ seriesId: vars.seriesId!, warning: result.warning });
        return;
      }
      invalidateBooking();
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setSeriesError(null);
    },
    onError: (error) => {
      const msg = error instanceof Response && error.status === 409
        ? 'This booking has non-VOID invoices. Void or delete them before adding to a series.'
        : 'Failed to update series assignment. Please try again.';
      setSeriesError(msg);
    },
  });

  function handleOverviewSave(changes: OverviewChanges) {
    const { series, ...rest } = changes;
    setSeriesError(null);
    setSeriesConfirmation(null);
    if (Object.keys(rest).length > 0) overviewSave.mutate(rest);
    if (series) dispatchSeriesChange(series);
  }

  function dispatchSeriesChange(series: SeriesChange, confirm?: boolean) {
    if (series.mode === 'none')     seriesSave.mutate({ seriesId: null });
    else if (series.mode === 'existing') seriesSave.mutate({ seriesId: series.seriesId, confirm });
    else                            seriesSave.mutate({ newSeriesLabel: series.label });
  }

  // ── People mutations ───────────────────────────────────────────────────────

  const peopleSave = useMutation({
    mutationFn: async (selection: PeopleSelection): Promise<void> => {
      const patch: { customerId?: string; bookingAgentId?: string | null } = {};
      if (selection.customer) {
        if (selection.customer.kind === 'new') {
          const c = await apiPost<Contact>('/contacts', { ...selection.customer.contact, primaryRole: 'CUSTOMER' });
          patch.customerId = c.id;
        } else if (selection.customer.contactId) {
          patch.customerId = selection.customer.contactId;
        }
      }
      if (selection.agent) {
        if (selection.agent.kind === 'new') {
          const c = await apiPost<Contact>('/contacts', { ...selection.agent.contact, primaryRole: 'BOOKING_AGENT' });
          patch.bookingAgentId = c.id;
        } else {
          patch.bookingAgentId = selection.agent.contactId;
        }
      }
      await apiPatch(`/bookings/${id}`, patch);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contacts'] }); invalidateBooking(); },
    onError: () => toast({ title: 'Failed to save people. Please try again.', variant: 'destructive' }),
  });

  // ── Venue mutations ────────────────────────────────────────────────────────

  const venueSave = useMutation({
    mutationFn: async (selection: VenueSelection): Promise<void> => {
      let venueId: string | null;
      if (selection.kind === 'new') {
        const c = await apiPost<Contact>('/contacts', { ...selection.venue, primaryRole: 'VENUE' });
        venueId = c.id;
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      } else {
        venueId = selection.venueId;
      }
      await apiPatch(`/bookings/${id}`, { venueId });
    },
    onSuccess: invalidateBooking,
    onError: () => toast({ title: 'Failed to save venue. Please try again.', variant: 'destructive' }),
  });

  // ── Template mutations (Package Templates + Itinerary share the accept-suggestion path) ─

  const acceptSuggestion = useMutation({
    mutationFn: async (suggestion: MusicFormSuggestion) => {
      const config = await apiGet<MusicFormConfig>(`/bookings/${id}/music-form-config`);
      const seen = new Set(config.keyMoments.map((km) => `${km.section} ${km.label}`));
      return apiPut(`/bookings/${id}/music-form-config`, {
        keyMoments: [
          ...config.keyMoments,
          ...suggestion.keyMoments.filter((km) => !seen.has(`${km.section} ${km.label}`)),
        ],
        enabledGenres: Array.from(new Set([...config.enabledGenres, ...suggestion.genres])),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id] });
      setPendingSuggestion(null);
    },
    onError: () => toast({ title: 'Failed to add suggestions. Please try again.', variant: 'destructive' }),
  });

  const applyStagedTemplates = useMutation({
    // Apply staged templates sequentially, merging their music-form suggestions into one banner.
    // Each apply is destructive (creates a Package + Sets), so a mid-batch failure must NOT lose
    // what already landed nor risk re-applying it: succeeded ids drop out and only the failed
    // remainder stays staged, so a retry applies just those (cf. the #543 contact-resolve cache).
    mutationFn: async (templateIds: string[]) => {
      let merged: MusicFormSuggestion | null = null;
      const failed: string[] = [];
      for (const packageTemplateId of templateIds) {
        try {
          const data = await apiPost<ApplyPackageTemplateResponse>(`/bookings/${id}/packages`, { packageTemplateId });
          const s = data.suggestion;
          if (s && (s.keyMoments.length || s.genres.length)) {
            merged = merged
              ? { genres: [...new Set([...merged.genres, ...s.genres])], keyMoments: [...merged.keyMoments, ...s.keyMoments] }
              : s;
          }
        } catch {
          failed.push(packageTemplateId);
        }
      }
      return { merged, failed };
    },
    onSuccess: ({ merged, failed }) => {
      invalidateBooking();
      setStagedTemplateIds(failed); // keep only what didn't land, so a retry can't double-apply
      if (merged) setPendingSuggestion(merged);
      if (failed.length) {
        toast({ title: `Couldn't apply ${pluralPackages(failed.length)}. Please try again.`, variant: 'destructive' });
      }
    },
  });

  const itineraryApplyTemplate = useMutation({
    mutationFn: (packageTemplateId: string) =>
      apiPost<ApplyPackageTemplateResponse>(`/bookings/${id}/packages`, { packageTemplateId }),
    onSuccess: (data) => {
      invalidateBooking();
      const s = data.suggestion;
      if (s && (s.keyMoments.length || s.genres.length)) setPendingSuggestion(s);
    },
    onError: () => toast({ title: 'Failed to add package. Please try again.', variant: 'destructive' }),
  });

  // ── Itinerary mutations ────────────────────────────────────────────────────

  const { addSet, updateSet, deleteSet, moveSet, updatePackage, removePackage } =
    useItineraryMutations(id!, booking?.sets ?? []);

  const saveAnchors = useMutation({
    mutationFn: (anchors: Record<string, BookingLogisticsEntry>) =>
      apiPatch(`/bookings/${id}`, { logistics: { ...nonAnchorKeys(booking?.logistics ?? null), ...anchors } }),
    onSuccess: invalidateBooking,
  });

  // ── Details mutations ──────────────────────────────────────────────────────

  const detailsSave = useMutation({
    mutationFn: (detailsLogistics: DetailsLogistics) =>
      apiPatch(`/bookings/${id}`, {
        logistics: { ...preservedTimeKeys(booking?.logistics ?? null), ...detailsLogistics },
      }),
    onSuccess: invalidateBooking,
  });

  // ── Music mutations ────────────────────────────────────────────────────────

  const musicSave = useMutation({
    mutationFn: (payload: { keyMoments: KeyMoment[]; enabledGenres: string[] }) =>
      apiPut<MusicFormConfig>(`/bookings/${id}/music-form-config`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id!] });
    },
    onError: () => toast({ title: 'Failed to save music form. Please try again.', variant: 'destructive' }),
  });

  const musicPublish = useMutation({
    mutationFn: (payload: { keyMoments: KeyMoment[]; enabledGenres: string[] }) =>
      apiPost<MusicFormConfig>(`/bookings/${id}/music-form-config/publish`, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['booking-music-form-config', id!], data);
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id!] });
      queryClient.invalidateQueries({ queryKey: ['booking', id!] });
    },
    onError: () => toast({ title: 'Failed to publish music form. Please try again.', variant: 'destructive' }),
  });

  const musicUnpublish = useMutation({
    mutationFn: () => apiPost<MusicFormConfig>(`/bookings/${id}/music-form-config/unpublish`, {}),
    onSuccess: (data) => {
      queryClient.setQueryData(['booking-music-form-config', id!], data);
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id!] });
      queryClient.invalidateQueries({ queryKey: ['booking', id!] });
    },
    onError: () => toast({ title: 'Failed to un-publish music form. Please try again.', variant: 'destructive' }),
  });

  const musicTurnOn = useMutation({
    mutationFn: () =>
      apiPut<MusicFormConfig>(`/bookings/${id}/music-form-config`, { keyMoments: [], enabledGenres: DEFAULT_ENABLED_GENRES }),
    onSuccess: (data) => {
      queryClient.setQueryData<BookingDetail>(['booking', id!], (old) =>
        old ? { ...old, hasMusicFormConfig: true } : old,
      );
      queryClient.setQueryData(['booking-music-form-config', id!], data);
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id!] });
      queryClient.invalidateQueries({ queryKey: ['booking', id!] });
    },
    onError: () => toast({ title: 'Failed to turn on music form. Please try again.', variant: 'destructive' }),
  });

  const musicTurnOff = useMutation({
    mutationFn: () => apiDelete(`/bookings/${id}/music-form-config`),
    onSuccess: () => {
      queryClient.setQueryData<BookingDetail>(['booking', id!], (old) =>
        old ? { ...old, hasMusicFormConfig: false } : old,
      );
      queryClient.removeQueries({ queryKey: ['booking-music-form-config', id!] });
      queryClient.invalidateQueries({ queryKey: ['booking', id!] });
    },
    onError: () => toast({ title: 'Failed to remove music form. Please try again.', variant: 'destructive' }),
  });

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

  const itineraryAddingKey = addSet.isPending ? (addSet.variables?.packageId ?? NO_PACKAGE) : null;

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

          {/* Overview */}
          <BuilderSection id="overview" title="Overview" sectionRef={overviewRef}>
            <OverviewAtom
              initialEventType={booking.eventType}
              initialDate={booking.date.slice(0, 10)}
              initialFee={booking.fee}
              initialTitle={booking.title}
              initialSeriesId={booking.seriesId}
              series={seriesList}
              onSave={handleOverviewSave}
              isSaving={overviewSave.isPending || seriesSave.isPending}
              saved={!overviewSave.isPending && !seriesSave.isPending && (overviewSave.isSuccess || seriesSave.isSuccess)}
              saveError={seriesError ?? (overviewSave.isError ? 'Failed to save. Please try again.' : null)}
            />
            {seriesConfirmation && (
              <div className="mt-4 p-4 border border-border rounded-md bg-muted/30 space-y-3">
                <p className="text-sm">{seriesConfirmation.warning}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const { seriesId } = seriesConfirmation;
                      setSeriesConfirmation(null);
                      seriesSave.mutate({ seriesId, confirm: true });
                    }}
                    disabled={seriesSave.isPending}
                  >
                    {seriesSave.isPending ? 'Saving…' : 'Continue anyway'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSeriesConfirmation(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <div className="mt-6">
              <RemindMeAboutContainer bookingId={id!} concern="overview" currentStatus={booking.status} />
            </div>
          </BuilderSection>

          {/* People */}
          <BuilderSection id="people" title="People" sectionRef={peopleRef}>
            <PeopleAtom
              customer={booking.customer ?? null}
              agent={booking.bookingAgent ?? null}
              onSave={(sel) => peopleSave.mutate(sel)}
              isSaving={peopleSave.isPending}
              saved={peopleSave.isSuccess}
              saveError={peopleSave.isError ? 'Failed to save. Please try again.' : null}
            />
            <div className="mt-6">
              <RemindMeAboutContainer bookingId={id!} concern="people" currentStatus={booking.status} />
            </div>
          </BuilderSection>

          {/* Venue */}
          <BuilderSection id="venue" title="Venue" sectionRef={venueRef}>
            <VenueAtom
              venue={booking.venue ?? null}
              onSave={(sel) => venueSave.mutate(sel)}
              isSaving={venueSave.isPending}
              saved={venueSave.isSuccess}
              saveError={venueSave.isError ? 'Failed to save. Please try again.' : null}
            />
            <div className="mt-6">
              <RemindMeAboutContainer bookingId={id!} concern="venue" currentStatus={booking.status} />
            </div>
          </BuilderSection>

          {/* Package Templates */}
          <BuilderSection id="templates" title="Package Templates" sectionRef={templatesRef}>
            {booking.packages.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {booking.packages.map((pkg) => (
                  <span
                    key={pkg.id}
                    className="inline-flex items-center rounded-full bg-secondary border border-border px-3 py-1 text-sm"
                  >
                    {pkg.label}
                  </span>
                ))}
              </div>
            )}
            {pendingSuggestion && (
              <div className="mb-4 rounded border border-border bg-primary/5 p-3 space-y-2">
                <p className="text-sm">
                  This package suggests{' '}
                  {pendingSuggestion.keyMoments.length > 0 && (
                    <span className="font-medium">{pendingSuggestion.keyMoments.length} special request{pendingSuggestion.keyMoments.length === 1 ? '' : 's'}</span>
                  )}
                  {pendingSuggestion.keyMoments.length > 0 && pendingSuggestion.genres.length > 0 && ' and '}
                  {pendingSuggestion.genres.length > 0 && (
                    <span className="font-medium">{pendingSuggestion.genres.length} genre{pendingSuggestion.genres.length === 1 ? '' : 's'}</span>
                  )}{' '}
                  for the music form.
                </p>
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={() => acceptSuggestion.mutate(pendingSuggestion)} disabled={acceptSuggestion.isPending}>
                    {acceptSuggestion.isPending ? 'Adding…' : 'Add to music form'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setPendingSuggestion(null)}
                    className="text-sm text-muted transition-colors hover:text-foreground"
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}
            <PackagePicker
              templates={templates}
              templatesLoading={templatesLoading}
              eventType={booking.eventType}
              selectedIds={stagedTemplateIds}
              onToggle={(tid) =>
                setStagedTemplateIds((s) => (s.includes(tid) ? s.filter((x) => x !== tid) : [...s, tid]))
              }
              showMusic={booking.hasMusicFormConfig}
            />
            {stagedTemplateIds.length > 0 && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-primary/5 p-3">
                <Button
                  size="sm"
                  onClick={() => applyStagedTemplates.mutate(stagedTemplateIds)}
                  disabled={applyStagedTemplates.isPending}
                >
                  {applyStagedTemplates.isPending ? 'Applying…' : `Apply ${pluralPackages(stagedTemplateIds.length)}`}
                </Button>
                <p className="text-xs text-muted">Staged — nothing is added until you Apply.</p>
              </div>
            )}
          </BuilderSection>

          {/* Itinerary */}
          <BuilderSection id="itinerary" title="Itinerary" sectionRef={itineraryRef}>
            <ItineraryAtom
              sets={booking.sets}
              packages={booking.packages}
              initialLogistics={booking.logistics}
              eventType={booking.eventType}
              templates={templates}
              templatesLoading={templatesLoading}
              onAddSet={(packageId, values) => addSet.mutate({ packageId, values })}
              onUpdateSet={(setId, values) => updateSet.mutate({ setId, values })}
              onDeleteSet={(setId) => deleteSet.mutate(setId)}
              onMoveSet={(setId, packageId) => moveSet.mutate({ setId, packageId })}
              onApplyTemplate={(templateId) => itineraryApplyTemplate.mutate(templateId)}
              onUpdatePackage={(packageId, dto) => updatePackage.mutate({ packageId, dto })}
              onRemovePackage={(packageId) => removePackage.mutate(packageId)}
              onSaveAnchors={(anchors) => saveAnchors.mutate(anchors)}
              savingSetId={updateSet.isPending ? updateSet.variables?.setId ?? null : null}
              deletingSetId={deleteSet.isPending ? deleteSet.variables ?? null : null}
              movingSetId={moveSet.isPending ? moveSet.variables?.setId ?? null : null}
              addingKey={itineraryAddingKey}
              isApplyingTemplate={itineraryApplyTemplate.isPending}
              removingPackageId={removePackage.isPending ? removePackage.variables ?? null : null}
              anchorsSaving={saveAnchors.isPending}
              anchorsSaved={saveAnchors.isSuccess}
              anchorsError={saveAnchors.isError ? 'Failed to save times. Please try again.' : null}
            />
            <div className="mt-6">
              <RemindMeAboutContainer bookingId={id!} concern="itinerary" currentStatus={booking.status} />
            </div>
          </BuilderSection>

          {/* Details */}
          <BuilderSection id="details" title="Details" sectionRef={detailsRef}>
            <DetailsAtom
              initialLogistics={booking.logistics}
              onSave={(detailsLogistics) => detailsSave.mutate(detailsLogistics)}
              isSaving={detailsSave.isPending}
              saved={detailsSave.isSuccess}
              saveError={detailsSave.isError ? 'Failed to save details. Please try again.' : null}
            />
          </BuilderSection>

          {/* Music */}
          <BuilderSection id="music" title="Music" sectionRef={musicRef}>
            {/* Only mount the atom after the config query settles so its state initialises
                from the loaded config rather than from a null placeholder. */}
            {booking.hasMusicFormConfig && musicConfigLoading ? (
              <div className="h-16 bg-border rounded animate-pulse" />
            ) : (
              <MusicAtom
                hasMusicFormConfig={booking.hasMusicFormConfig}
                config={musicConfig}
                packages={booking.packages}
                onSave={(payload) => musicSave.mutate(payload)}
                onTurnOn={() => musicTurnOn.mutate()}
                onTurnOff={() => musicTurnOff.mutate()}
                isPublished={musicConfig?.publishedAt != null}
                onPublish={(payload) => musicPublish.mutate(payload)}
                onUnpublish={() => musicUnpublish.mutate()}
                isPublishing={musicPublish.isPending}
                isUnpublishing={musicUnpublish.isPending}
                isSaving={musicSave.isPending}
                saved={musicSave.isSuccess}
                saveError={musicSave.isError ? 'Failed to save music form. Please try again.' : null}
                isTurningOn={musicTurnOn.isPending}
                isTurningOff={musicTurnOff.isPending}
              />
            )}
            <div className="mt-6">
              <RemindMeAboutContainer bookingId={id!} concern="music" currentStatus={booking.status} />
            </div>
          </BuilderSection>

          {/* Notes */}
          <BuilderSection id="notes" title="Notes" sectionRef={notesRef}>
            <InlineNotes
              notes={booking.notes}
              onSave={(notes) => fields.updateNotes(notes)}
              isSaving={fields.isNotesPending}
            />
          </BuilderSection>

          {/* Mobile Done button */}
          <div className="flex justify-end pb-8 md:hidden">
            <Button onClick={handleDone}>Done</Button>
          </div>
        </div>

        {/* ── Completeness rail (desktop only) ─────────────────────────────── */}
        <aside className="hidden md:block sticky top-20">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Sections</p>
          <CompletenessRail completeness={completeness} onScrollTo={scrollTo} />
          <div className="mt-6">
            <Button className="w-full" onClick={handleDone}>Done</Button>
          </div>
        </aside>
      </div>

      <ExitBackstopDialog
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
