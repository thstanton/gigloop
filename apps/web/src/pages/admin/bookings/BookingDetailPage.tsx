import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Check, X, FolderOpen, FileText, Download, MapPin } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingActions } from '@/lib/hooks/useBookingActions';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import SeriesInvoiceCard from '@/features/bookings/SeriesInvoiceCard';
import { useBookingCommunications } from '@/lib/hooks/useBookingCommunications';
import { useBookingDocuments } from '@/lib/hooks/useBookingDocuments';
import BookingEditDrawer from '@/features/bookings/BookingEditDrawer';
import ContactPicker from '@/features/bookings/ContactPicker';
import ContractSheet from '@/features/bookings/ContractSheet';
import ContactEditSheet from '@/features/contacts/ContactEditSheet';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import ContractCard from '@/features/bookings/ContractCard';
import InvoiceSection from '@/features/bookings/InvoiceSection';
import { VenueMapWidget } from '@/components/common/VenueMapWidget';
import PersonCard from '@/features/bookings/PersonCard';
import CommunicationsSection from '@/features/bookings/CommunicationsSection';
import PerformanceSection from '@/features/bookings/PerformanceSection';
import MusicFormSection from '@/features/bookings/MusicFormSection';
import ChecklistSection from '@/features/bookings/ChecklistSection';
import BookingStatusDropdown from '@/features/bookings/BookingStatusDropdown';
import InlineNotes from '@/features/bookings/InlineNotes';
import InlineFeeAdd from '@/features/bookings/InlineFeeAdd';
import { toast } from '@/lib/hooks/use-toast';
import { apiGet, apiPatch, apiPost, apiPostVoid, apiPut, apiDelete } from '@/lib/api';
import {
  formatDate,
  formatCurrency,
  formatFee,
} from '@/lib/formatters';
import { EVENT_TYPE_LABELS, STATUS_ORDER } from '@/lib/constants';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { IconButton } from '@/components/common/IconButton';
import type {
  BookingDetail,
  BookingSeries,
  BookingStatus,
  ChecklistItem,
  Contact,
  Contract,
  Document,
  Invoice,
  MusicFormConfig,
  MusicFormResponse,
  Template,
  TravelTimeResponse,
  UpdateBookingSeriesResponse,
  UserProfile,
} from '@/types/api';

function isSeriesConfirmationRequired(r: object): r is Required<UpdateBookingSeriesResponse> {
  return 'requiresConfirmation' in r;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CELEBRATORY_TITLES = [
  "You're smashing it!",
  "Nice work!",
  "All done!",
  "You're on a roll!",
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  ENQUIRY:      'Enquiry',
  PROVISIONAL:  'Provisional',
  CONFIRMED:    'Confirmed',
  READY:        'Ready',
  COMPLETE:     'Complete',
  CANCELLED:    'Cancelled',
};

// ─── InlineVenueAdd ───────────────────────────────────────────────────────────

function InlineVenueAdd({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [venueId, setVenueId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/bookings/${bookingId}`, { venueId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setEditing(false);
      setVenueId(null);
    },
  });

  if (editing) {
    return (
      <Card title="Venue">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ContactPicker
              value={venueId}
              onChange={setVenueId}
              placeholder="Select venue..."
              label="venue"
              preferredRole="VENUE"
            />
          </div>
          <button
            type="button"
            disabled={!venueId || mutation.isPending}
            onClick={() => { if (venueId) mutation.mutate(venueId); }}
            className="text-status-confirmed hover:text-status-confirmed/70 disabled:opacity-40 transition-colors flex-shrink-0"
            aria-label="Save venue"
          >
            <Check size={16} />
          </button>
          <IconButton label="Cancel" className="flex-shrink-0" onClick={() => { setEditing(false); setVenueId(null); }}>
            <X size={16} />
          </IconButton>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-2 py-4 text-muted min-h-[5rem]">
      <MapPin size={20} />
      <span className="text-sm font-medium">Venue</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm text-primary hover:text-primary/80 transition-colors"
      >
        + Add
      </button>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-4 md:px-6 py-6 max-w-2xl animate-pulse space-y-6">
      <div className="h-4 w-24 bg-border rounded" />
      <div className="space-y-2">
        <div className="h-7 w-56 bg-border rounded" />
        <div className="h-4 w-32 bg-border rounded" />
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => <div key={i} className="h-4 w-48 bg-border rounded" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-32 bg-border rounded-lg" />
        <div className="h-32 bg-border rounded-lg" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const backNav = (location.state as { from?: string; label?: string } | null);
  const [, setSearchParams] = useSearchParams();

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTemplateType, setComposeTemplateType] = useState<string | undefined>();
  const [invoiceSheetOpen, setInvoiceSheetOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>();
  const [invoiceSheetPrefill, setInvoiceSheetPrefill] = useState<{ isDeposit: boolean; amount?: number; description?: string } | undefined>();
  const [markSentInvoice, setMarkSentInvoice] = useState<Invoice | undefined>();
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contractSheetOpen, setContractSheetOpen] = useState(false);
  const [contractSheetReadOnly, setContractSheetReadOnly] = useState(false);
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);
  const [readyDialogStatus, setReadyDialogStatus] = useState<BookingStatus | null>(null);
  const [viewingMusicFormResponse, setViewingMusicFormResponse] = useState(false);
  const [seriesSheetOpen, setSeriesSheetOpen] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seriesConfirm, setSeriesConfirm] = useState<{ warning: string; seriesId: string } | null>(null);
  const dismissedTransitions = useRef(new Set<string>());
  const celebratoryTitle = useRef(CELEBRATORY_TITLES[Math.floor(Math.random() * CELEBRATORY_TITLES.length)]);

  const { isLoaded } = useAuth();
  const { data: booking, isLoading, isError } = useBooking(id!);
  const { data: invoices = [], isPending: invoicesPending } = useBookingInvoices(id!);
  const { data: communications = [] } = useBookingCommunications(id!);
  const { data: documents = [] } = useBookingDocuments(id!);
  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const bookingVenueId = booking?.venue?.id;
  const { data: travelTimeData, isFetching: isFetchingTravelTime } = useQuery({
    queryKey: ['contact-travel-time', bookingVenueId],
    queryFn: () => apiGet<TravelTimeResponse>(`/contacts/${bookingVenueId}/travel-time`),
    enabled: isLoaded && !!bookingVenueId && !!booking?.venue?.latitude && !!booking?.venue?.longitude && !!userProfile?.latitude && !!userProfile?.longitude,
  });

  const actions = useBookingActions(id!);
  const queryClient = useQueryClient();

  const { data: seriesList } = useQuery({
    queryKey: ['series'],
    queryFn: () => apiGet<BookingSeries[]>('/series'),
    enabled: isLoaded && seriesSheetOpen,
  });

  const updateSeriesMutation = useMutation({
    mutationFn: (payload: { seriesId: string | null; confirm?: boolean }) =>
      apiPatch<UpdateBookingSeriesResponse | BookingDetail>(`/bookings/${id}/series`, payload),
    onSuccess: (result) => {
      if (isSeriesConfirmationRequired(result) && selectedSeriesId) {
        setSeriesConfirm({ warning: result.warning, seriesId: selectedSeriesId });
        return;
      }
      setSeriesSheetOpen(false);
      setSeriesConfirm(null);
      setSelectedSeriesId(null);
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: () => toast({ title: 'Failed to update series assignment', variant: 'destructive' }),
  });

  const { data: checklist = [], isPending: checklistLoading } = useQuery({
    queryKey: ['bookingChecklist', id],
    queryFn: () => apiGet<ChecklistItem[]>(`/bookings/${id}/checklist`),
    enabled: isLoaded && !!booking && booking.status !== 'CANCELLED',
  });

  const { data: musicFormConfig, isLoading: musicFormConfigLoading } = useQuery({
    queryKey: ['booking-music-form-config', id],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${id}/music-form-config`),
    enabled: isLoaded && !!booking && booking.hasMusicFormConfig,
  });

  const { data: musicFormResponse } = useQuery({
    queryKey: ['booking-music-form-response', id],
    queryFn: () => apiGet<MusicFormResponse>(`/bookings/${id}/music-form-response`),
    enabled: isLoaded && !!booking && booking.hasMusicFormResponse && viewingMusicFormResponse,
  });

  useQuery({
    queryKey: ['templates'],
    queryFn: () => apiGet<Template[]>('/templates'),
    enabled: isLoaded,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!booking || checklistLoading || checklist.length === 0) return;
    const targetStatus = (['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const).find((s) => {
      const targetIdx = STATUS_ORDER.indexOf(s);
      const currentIdx = STATUS_ORDER.indexOf(booking.status);
      if (targetIdx <= currentIdx) return false;
      const key = `${id}:${booking.status}->${s}`;
      if (dismissedTransitions.current.has(key)) return false;
      const forStatus = checklist.filter((i) => i.requiredForStatus === s);
      return forStatus.length > 0 && forStatus.every((i) => i.state === 'COMPLETE');
    });
    if (targetStatus) setReadyDialogStatus(targetStatus);
  }, [booking, checklist, checklistLoading, id]);

  function invalidateBooking() {
    queryClient.invalidateQueries({ queryKey: ['booking', id] });
    queryClient.invalidateQueries({ queryKey: ['bookingChecklist', id] });
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  const updateStatusMutation = useMutation({
    mutationFn: (status: BookingStatus) =>
      apiPatch<BookingDetail>(`/bookings/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', id] });
    },
    onError: () => {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: (notes: string) => apiPatch(`/bookings/${id}`, { notes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const updateFeeMutation = useMutation({
    mutationFn: (fee: number) => apiPatch(`/bookings/${id}`, { fee }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const createContract = useMutation({
    mutationFn: () => apiPost<Contract>(`/bookings/${id}/contracts`, {}),
    onSuccess: (data) => {
      setPendingContract(data);
      invalidateBooking();
      setContractSheetReadOnly(false);
      setContractSheetOpen(true);
    },
    onError: () => toast({ title: 'Failed to create contract', variant: 'destructive' }),
  });

  const sendContractMutation = useMutation({
    mutationFn: (contractId: string) => apiPostVoid(`/bookings/${id}/contracts/${contractId}/send`, {}),
    onSuccess: () => invalidateBooking(),
    onError: () => toast({ title: 'Failed to mark contract as sent', variant: 'destructive' }),
  });

  const voidContractMutation = useMutation({
    mutationFn: ({ contractId, confirmSignedVoid }: { contractId: string; confirmSignedVoid: boolean }) =>
      apiPostVoid(`/bookings/${id}/contracts/${contractId}/void`, { confirmSignedVoid }),
    onSuccess: () => invalidateBooking(),
    onError: () => toast({ title: 'Failed to void contract', variant: 'destructive' }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: (contractId: string) => apiDelete(`/bookings/${id}/contracts/${contractId}`),
    onSuccess: () => invalidateBooking(),
    onError: () => toast({ title: 'Failed to delete contract', variant: 'destructive' }),
  });

  const voidInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => apiPostVoid(`/bookings/${id}/invoices/${invoiceId}/void`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', id] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', id] });
    },
    onError: () => toast({ title: 'Failed to void invoice', variant: 'destructive' }),
  });

  const markPaid = useMutation({
    mutationFn: (invoiceId: string) => apiPost(`/bookings/${id}/invoices/${invoiceId}/mark-paid`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', id] });
      invalidateBooking();
    },
    onError: () => toast({ title: 'Failed to mark invoice as paid', variant: 'destructive' }),
  });

  const toggleChecklistItem = useMutation({
    mutationFn: ({ itemId, state }: { itemId: string; state: 'COMPLETE' | 'PENDING' }) =>
      apiPatch(`/bookings/${id}/checklist/${itemId}`, { state }),
    onMutate: async ({ itemId, state }) => {
      await queryClient.cancelQueries({ queryKey: ['bookingChecklist', id] });
      const previous = queryClient.getQueryData<ChecklistItem[]>(['bookingChecklist', id]);
      queryClient.setQueryData<ChecklistItem[]>(['bookingChecklist', id], (old) =>
        old?.map((item) => item.id === itemId ? { ...item, state } : item) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['bookingChecklist', id], context.previous);
      toast({ title: 'Failed to update checklist item', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', id] });
    },
  });

  const addChecklistItem = useMutation({
    mutationFn: (data: { label: string; requiredForStatus: string | null; dueDate: string | null }) =>
      apiPost(`/bookings/${id}/checklist`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', id] });
    },
    onError: () => toast({ title: 'Failed to add item', variant: 'destructive' }),
  });

  const configureMusicForm = useMutation({
    mutationFn: () => {
      if (!booking) return Promise.reject(new Error('No booking'));
      const seedKeyMoments = (booking.packages ?? []).flatMap((bpf) =>
        bpf.package.keyMoments.map((km) => ({ label: km, section: bpf.package.label })),
      );
      const seedGenres = [...new Set((booking.packages ?? []).flatMap((bpf) => bpf.package.defaultGenreSelection))];
      return apiPut<MusicFormConfig>(`/bookings/${id}/music-form-config`, {
        keyMoments: seedKeyMoments,
        enabledGenres: seedGenres,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', id] });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('edit', 'true'); return next; });
    },
  });

  const unlinkVenueMutation = useMutation({
    mutationFn: () => apiPatch(`/bookings/${id}`, { venueId: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setEditingContact(null);
    },
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function openCompose(templateType?: string) {
    setComposeTemplateType(templateType);
    setComposeOpen(true);
  }

  function buildSetsDescription(): string {
    if (!booking?.sets?.length) return '';
    const formatById = new Map(
      (booking.packages ?? []).map((f) => [f.packageId, f.package.label]),
    );
    return booking.sets
      .map((s) => {
        const label = s.label ?? (s.packageId ? formatById.get(s.packageId) : null) ?? null;
        return label ? `${label} (${s.duration} min)` : `${s.duration} min`;
      })
      .join(', ');
  }

  function openCreateInvoice(prefill?: { isDeposit: boolean; amount?: number }) {
    setEditingInvoice(undefined);
    setInvoiceSheetPrefill(prefill ? { ...prefill, description: buildSetsDescription() } : undefined);
    setInvoiceSheetOpen(true);
  }

  function openEditInvoice(invoice: Invoice) {
    setEditingInvoice(invoice);
    setInvoiceSheetPrefill(undefined);
    setInvoiceSheetOpen(true);
  }

  function openSendInvoice(invoice: Invoice) {
    const templateType = invoice.isDeposit ? 'deposit_invoice_cover' : 'balance_invoice_cover';
    openCompose(templateType);
  }

  function handleChecklistAction(action: 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract') {
    if (action === 'create_contract') {
      createContract.mutate();
      return;
    }
    const isDeposit = action === 'create_deposit_invoice';
    const fee = booking?.fee ? parseFloat(booking.fee) : null;
    const pct = userProfile?.depositPercentage;

    if (fee && pct) {
      const amount = isDeposit ? (fee * pct) / 100 : fee * (1 - pct / 100);
      actions.autoCreateInvoice({ isDeposit, amount: Math.round(amount * 100) / 100 });
    } else {
      openCreateInvoice({ isDeposit });
    }
  }

  function handleMarkDone(key: 'mark_contract_signed' | 'mark_deposit_received') {
    if (key === 'mark_contract_signed') {
      if (booking?.activeContract) actions.markContractSigned(booking.activeContract.id);
    } else {
      const sentDeposit = invoices.find((inv) => inv.isDeposit && inv.status === 'SENT');
      if (sentDeposit) markPaid.mutate(sentDeposit.id);
      else actions.markDepositReceived();
    }
  }

  if (isLoading) return <PageSkeleton />;

  if (isError || !booking) {
    return (
      <div className="px-4 md:px-6 py-6">
        <p className="text-sm text-muted">Booking not found.</p>
        <Link
          to="/admin/bookings"
          className="text-sm text-primary underline underline-offset-2 mt-2 block"
        >
          Back to bookings
        </Link>
      </div>
    );
  }

  const title = booking.title ?? EVENT_TYPE_LABELS[booking.eventType];
  const fee = formatFee(booking.fee);
  const feeWithVat = userProfile?.vatNumber && booking.fee
    ? `${fee} (${formatCurrency(parseFloat(booking.fee) * (1 + (userProfile.vatRate ?? 20) / 100))} inc. VAT)`
    : fee;
  const hasDepositItem = checklist.some((item) => item.key === 'deposit_received');
  const contractShortcutType = hasDepositItem ? 'contract_and_deposit_cover' : 'contract_cover';

  const backState = { from: `/admin/bookings/${id}`, label: title };
  const backUrl = encodeURIComponent(`/admin/bookings/${booking.id}`);

  let venueTravelTime: { minutes: number; distanceMetres: number } | null = null;
  if (travelTimeData) {
    venueTravelTime = { minutes: travelTimeData.minutes, distanceMetres: travelTimeData.distanceMetres };
  } else if (booking.venue?.travelTimeMinutes != null && booking.venue?.travelDistanceMetres != null) {
    venueTravelTime = { minutes: booking.venue.travelTimeMinutes, distanceMetres: booking.venue.travelDistanceMetres };
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">

      {/* Back */}
      <Link
        to={backNav?.from ?? '/admin/bookings'}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        {backNav?.label ?? 'Bookings'}
      </Link>

      <div className="mt-6 md:grid md:grid-cols-[3fr_2fr] md:gap-8 md:items-start">

        {/* ─── Left column ─── */}
        <div className="space-y-8">

          {/* 1. Header */}
          <section>
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`/booking/${booking.portalToken}?preview=admin&from=${backUrl}`}
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors border border-border rounded px-3 py-1.5"
                >
                  Client portal
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchParams({ edit: 'true' })}
                >
                  Edit
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <BookingStatusDropdown
                currentStatus={booking.status}
                checklist={checklist}
                onStatusChange={(status) => updateStatusMutation.mutate(status)}
                isPending={updateStatusMutation.isPending}
              />
              <span className="text-sm text-muted">{formatDate(booking.date)}</span>
              {feeWithVat
                ? <span className="text-sm text-muted">{feeWithVat}</span>
                : <InlineFeeAdd onSave={(fee) => updateFeeMutation.mutate(fee)} isSaving={updateFeeMutation.isPending} />
              }
              {booking.series ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-foreground border border-border rounded-full px-3 py-1.5">
                  {booking.series.label}
                  <button
                    type="button"
                    onClick={() => updateSeriesMutation.mutate({ seriesId: null })}
                    className="hover:text-foreground transition-colors"
                    aria-label="Remove from series"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setSeriesSheetOpen(true)}
                  className="text-sm text-muted hover:text-foreground transition-colors underline underline-offset-2"
                >
                  + Add to series
                </button>
              )}
            </div>
          </section>

          {/* 2. People */}
          <section>
            <SectionHeader label="People" />
            <div className="border-t border-border">
              <PersonCard role="Customer" contact={booking.customer} linkState={backState} onEdit={() => setEditingContact(booking.customer)} />
              {booking.bookingAgent && (
                <PersonCard
                  role="Booking agent"
                  contact={booking.bookingAgent}
                  commissionArrangement={booking.bookingAgent.commissionArrangement}
                  linkState={backState}
                  onEdit={() => setEditingContact(booking.bookingAgent!)}
                />
              )}
            </div>
          </section>

          {/* 3. Notes */}
          <InlineNotes
            notes={booking.notes}
            onSave={(notes) => updateNotesMutation.mutate(notes)}
            isSaving={updateNotesMutation.isPending}
          />

          {/* 4. For the day */}
          <section>
            <SectionHeader label="For the day" />
            {booking.venue && (
              <div className="mb-4">
                <VenueMapWidget
                  venue={booking.venue}
                  showHeader={true}
                  cardTitle="Venue"
                  cardAction={
                    <button type="button" onClick={() => setEditingContact(booking.venue!)} className="text-xs text-primary hover:text-primary/80 transition-colors">
                      Edit
                    </button>
                  }
                  contactHref={`/admin/contacts/${booking.venue.id}`}
                  travelTime={venueTravelTime}
                  isLoadingTravelTime={isFetchingTravelTime}
                  onRefreshTravelTime={() => queryClient.invalidateQueries({ queryKey: ['contact-travel-time', bookingVenueId] })}
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PerformanceSection
                booking={booking}
                onEdit={() => setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('edit', 'true');
                  next.set('section', 'performance');
                  return next;
                })}
              />
              {!booking.venue && <InlineVenueAdd bookingId={booking.id} />}
              <MusicFormSection
                booking={booking}
                documents={documents}
                config={musicFormConfig ?? null}
                isLoading={musicFormConfigLoading}
                response={musicFormResponse ?? null}
                onUpdateConfig={() => configureMusicForm.mutate()}
                onViewResponse={() => setViewingMusicFormResponse(true)}
                onEdit={() => setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('edit', 'true');
                  next.set('section', 'musicForm');
                  return next;
                })}
              />
            </div>
          </section>

        </div>

        {/* ─── Right column ─── */}
        <div className="mt-8 md:mt-0 space-y-6">

          {/* Checklist */}
          {booking.status !== 'CANCELLED' && (
            <ChecklistSection
              items={checklist}
              isLoading={checklistLoading}
              bookingStatus={booking.status}
              contractTemplateType={contractShortcutType}
              onToggle={(itemId, state) => toggleChecklistItem.mutate({ itemId, state })}
              onChecklistAction={handleChecklistAction}
              onOpenCompose={openCompose}
              onMarkDone={handleMarkDone}
              onAddItem={(data) => addChecklistItem.mutate(data)}
              isAddingItem={addChecklistItem.isPending}
              isActionPending={actions.isPending || markPaid.isPending}
            />
          )}

          {/* Contract */}
          {booking.status !== 'CANCELLED' && (
            <ContractCard
              booking={booking}
              documents={documents}
              isCreating={createContract.isPending}
              onCreateContract={() => createContract.mutate()}
              onEdit={() => { setContractSheetReadOnly(false); setContractSheetOpen(true); }}
              onPreview={() => { setContractSheetReadOnly(true); setContractSheetOpen(true); }}
              onSend={() => openCompose(contractShortcutType)}
              onVoid={(confirmSignedVoid) => {
                const contractId = booking.activeContract?.id;
                if (contractId) voidContractMutation.mutate({ contractId, confirmSignedVoid });
              }}
              onDelete={() => {
                const contractId = booking.activeContract?.id;
                if (contractId) deleteContractMutation.mutate(contractId);
              }}
            />
          )}

          {/* Invoices */}
          {booking.series ? (
            <SeriesInvoiceCard
              seriesId={booking.series.id}
              seriesLabel={booking.series.label}
              onEdit={(inv) => {
                setEditingInvoice(inv as unknown as Invoice);
                setInvoiceSheetOpen(true);
              }}
              onSend={(inv) => {
                setComposeTemplateType('balance_invoice_cover');
                setComposeOpen(true);
                setEditingInvoice(inv as unknown as Invoice);
              }}
              onMarkSent={(inv) => setMarkSentInvoice(inv as unknown as Invoice)}
            />
          ) : (
            <InvoiceSection
              invoices={invoices}
              documents={documents}
              isPending={invoicesPending}
              onNewDepositInvoice={() => {
                const fee = booking.fee ? parseFloat(booking.fee) : null;
                const pct = userProfile?.depositPercentage;
                openCreateInvoice({
                  isDeposit: true,
                  amount: fee && pct ? Math.round((fee * pct / 100) * 100) / 100 : undefined,
                });
              }}
              onNewBalanceInvoice={() => {
                const fee = booking.fee ? parseFloat(booking.fee) : null;
                const pct = userProfile?.depositPercentage;
                openCreateInvoice({
                  isDeposit: false,
                  amount: fee && pct ? Math.round((fee * (1 - pct / 100)) * 100) / 100 : undefined,
                });
              }}
              onEdit={openEditInvoice}
              onDelete={(inv) => actions.deleteInvoice(inv.id)}
              onSend={openSendInvoice}
              onMarkSent={setMarkSentInvoice}
              onMarkPaid={(inv) => markPaid.mutate(inv.id)}
              onVoid={(inv) => voidInvoiceMutation.mutate(inv.id)}
            />
          )}

          {/* Documents */}
          <Card title="Documents">
            {documents.length === 0 ? (
              <div className="flex items-center gap-2 text-muted py-1">
                <FolderOpen size={14} />
                <span className="text-sm">No documents yet</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((doc: Document) => {
                  const invoice = invoices.find((i) => i.id === doc.invoiceId);
                  const isVoidContract = doc.type === 'CONTRACT' && doc.contractStatus === 'VOID';
                  const contractLabel = isVoidContract ? 'Contract [VOID]' : 'Contract';
                  const invoiceLabel = invoice?.isDeposit ? 'Deposit invoice' : 'Balance invoice';
                  const label = doc.type === 'CONTRACT' ? contractLabel : invoiceLabel;
                  const filename = `${label.toLowerCase().replace(' ', '-')}.pdf`;
                  const handleDownload = async () => {
                    const res = await fetch(doc.url);
                    const blob = await res.blob();
                    const a = window.document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  };
                  return (
                    <div key={doc.id} className="flex items-center gap-2 py-2">
                      <FileText size={14} className="flex-shrink-0 text-muted mt-0.5 self-start" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-foreground">{label}</span>
                        {invoice?.invoiceNumber && (
                          <span className="text-xs text-muted">{invoice.invoiceNumber}</span>
                        )}
                      </div>
                      <span className="text-muted ml-auto text-xs shrink-0">
                        {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        onClick={handleDownload}
                        title="Download"
                        className="text-muted hover:text-foreground shrink-0"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Communications */}
          <CommunicationsSection
            communications={communications}
            onCompose={() => openCompose()}
          />

        </div>{/* end right column */}
      </div>{/* end two-column grid */}

      {readyDialogStatus && (
        <Dialog open onOpenChange={() => {
          const key = `${id}:${booking.status}->${readyDialogStatus}`;
          dismissedTransitions.current.add(key);
          celebratoryTitle.current = CELEBRATORY_TITLES[Math.floor(Math.random() * CELEBRATORY_TITLES.length)];
          setReadyDialogStatus(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{celebratoryTitle.current}</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              You've completed all the tasks for this booking. Ready to move it to{' '}
              <span className="font-medium text-foreground">{STATUS_LABELS[readyDialogStatus]}</span>?
            </DialogDescription>
            <div className="flex gap-2 justify-end mt-2">
              <Button
                variant="outline"
                onClick={() => {
                  const key = `${id}:${booking.status}->${readyDialogStatus}`;
                  dismissedTransitions.current.add(key);
                  celebratoryTitle.current = CELEBRATORY_TITLES[Math.floor(Math.random() * CELEBRATORY_TITLES.length)];
                  setReadyDialogStatus(null);
                }}
              >
                Not yet
              </Button>
              <Button
                onClick={() => {
                  const next = readyDialogStatus;
                  setReadyDialogStatus(null);
                  apiPatch<BookingDetail>(`/bookings/${id}`, { status: next }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['booking', id] });
                    queryClient.invalidateQueries({ queryKey: ['bookings'] });
                    queryClient.invalidateQueries({ queryKey: ['bookingChecklist', id] });
                  });
                }}
              >
                Mark as {STATUS_LABELS[readyDialogStatus]}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ContractSheet
        bookingId={id!}
        contract={pendingContract ?? booking.activeContract}
        readOnly={contractSheetReadOnly}
        open={contractSheetOpen}
        onClose={() => { setContractSheetOpen(false); setPendingContract(null); }}
      />
      <BookingEditDrawer booking={booking} />
      <ContactEditSheet
        contact={editingContact}
        onClose={() => setEditingContact(null)}
        onUnlink={editingContact?.id === booking.venue?.id ? () => unlinkVenueMutation.mutate() : undefined}
      />
      <InvoiceSheet
        bookingId={id!}
        invoice={editingInvoice}
        hasDepositInvoice={invoices.some((inv) => inv.isDeposit)}
        prefill={invoiceSheetPrefill}
        open={invoiceSheetOpen}
        onOpenChange={setInvoiceSheetOpen}
      />
      <ComposeEmailSheet
        bookingId={id!}
        booking={booking}
        invoices={invoices}
        defaultPaymentTermsDays={userProfile?.defaultPaymentTermsDays}
        open={composeOpen}
        onOpenChange={setComposeOpen}
        initialTemplateType={composeTemplateType}
        onAfterSend={(templateType) => {
          const isContractEmail = templateType === 'contract_cover' || templateType === 'contract_and_deposit_cover';
          const contractId = booking.activeContract?.id;
          if (isContractEmail && contractId && booking.activeContract?.status === 'DRAFT') {
            sendContractMutation.mutate(contractId);
          }
        }}
      />
      {markSentInvoice && (
        <MarkSentDialog
          bookingId={id!}
          invoice={markSentInvoice}
          userProfile={userProfile}
          open={!!markSentInvoice}
          onOpenChange={(open) => { if (!open) setMarkSentInvoice(undefined); }}
        />
      )}

      {/* Add to series dialog */}
      <Dialog open={seriesSheetOpen} onOpenChange={(open) => { setSeriesSheetOpen(open); if (!open) setSelectedSeriesId(null); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add to series</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={selectedSeriesId ?? ''} onValueChange={setSelectedSeriesId}>
              <SelectTrigger>
                <SelectValue placeholder="Select series..." />
              </SelectTrigger>
              <SelectContent>
                {seriesList?.length
                  ? seriesList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))
                  : <div className="py-2 px-2 text-sm text-muted-foreground">No series available</div>
                }
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button
                onClick={() => { if (selectedSeriesId) updateSeriesMutation.mutate({ seriesId: selectedSeriesId }); }}
                disabled={!selectedSeriesId || updateSeriesMutation.isPending}
              >
                {updateSeriesMutation.isPending ? 'Saving…' : 'Add to series'}
              </Button>
              <Button variant="outline" onClick={() => setSeriesSheetOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer mismatch confirmation dialog */}
      <Dialog open={!!seriesConfirm} onOpenChange={(open) => { if (!open) setSeriesConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customer mismatch</DialogTitle>
          </DialogHeader>
          <DialogDescription className="pt-2">{seriesConfirm?.warning}</DialogDescription>
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => {
                if (seriesConfirm) {
                  updateSeriesMutation.mutate({ seriesId: seriesConfirm.seriesId, confirm: true });
                }
              }}
              disabled={updateSeriesMutation.isPending}
            >
              {updateSeriesMutation.isPending ? 'Saving…' : 'Continue anyway'}
            </Button>
            <Button variant="outline" onClick={() => setSeriesConfirm(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
