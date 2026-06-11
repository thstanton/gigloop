import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Eye, Pencil, X, FolderOpen, FileText, Download } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useInvoiceActions } from '@/lib/hooks/useInvoiceActions';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import SeriesInvoiceCard from '@/features/bookings/SeriesInvoiceCard';
import { SeriesEventsCard } from '@/features/bookings/SeriesEventsCard';
import { useSeriesBookings } from '@/lib/hooks/useSeriesBookings';
import { useBookingCommunications } from '@/lib/hooks/useBookingCommunications';
import { useBookingDocuments } from '@/lib/hooks/useBookingDocuments';
import BookingEditDrawer from '@/features/bookings/BookingEditDrawer';
import ContractSheet from '@/features/bookings/ContractSheet';
import ContactEditSheet from '@/features/contacts/ContactEditSheet';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import ContractCard from '@/features/bookings/ContractCard';
import InvoiceSection from '@/features/bookings/InvoiceSection';
import { VenueMapWidget } from '@/components/common/VenueMapWidget';
import PersonCard from '@/features/bookings/PersonCard';
import PersonChip from '@/features/bookings/PersonChip';
import CommunicationsSection from '@/features/bookings/CommunicationsSection';
import MusicFormSection from '@/features/bookings/MusicFormSection';
import ChecklistSection from '@/features/bookings/ChecklistSection';
import BookingStatusDropdown from '@/features/bookings/BookingStatusDropdown';
import InlineNotes from '@/features/bookings/InlineNotes';
import InlineFeeAdd from '@/features/bookings/InlineFeeAdd';
import ItineraryCard from '@/features/bookings/ItineraryCard';
import DetailsCard from '@/features/bookings/DetailsCard';
import PerformanceSection from '@/features/bookings/PerformanceSection';
import BookingDetailTabs from '@/features/bookings/BookingDetailTabs';
import { InlineVenueAdd } from '@/features/bookings/InlineVenueAdd';
import { apiGet } from '@/lib/api';
import {
  formatDate,
  formatCurrency,
  formatFee,
} from '@/lib/formatters';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import type {
  BookingDetail,
  BookingSeries,
  BookingStatus,
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

const STATUS_LABELS: Record<BookingStatus, string> = {
  ENQUIRY:      'Enquiry',
  PROVISIONAL:  'Provisional',
  CONFIRMED:    'Confirmed',
  READY:        'Ready',
  COMPLETE:     'Complete',
  CANCELLED:    'Cancelled',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto animate-pulse">
      {/* Back link */}
      <div className="h-4 w-20 bg-border rounded" />

      <div className="mt-6 md:grid md:grid-cols-[3fr_2fr] md:gap-8 md:items-start">

        {/* Left column */}
        <div className="space-y-8">

          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="h-8 w-48 bg-border rounded" />
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-border rounded" />
                <div className="h-8 w-16 bg-border rounded" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-6 w-24 bg-border rounded-full" />
              <div className="h-6 w-28 bg-border rounded" />
              <div className="h-6 w-20 bg-border rounded" />
            </div>
          </div>

          {/* People */}
          <div className="space-y-2">
            <div className="h-4 w-16 bg-border rounded" />
            <div className="border-t border-border divide-y divide-border">
              <div className="flex items-center gap-3 py-3">
                <div className="h-8 w-8 bg-border rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 bg-border rounded" />
                  <div className="h-3 w-20 bg-border rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <div className="h-4 w-12 bg-border rounded" />
            <div className="h-16 w-full bg-border rounded" />
          </div>

          {/* For the day */}
          <div className="space-y-4">
            <div className="h-4 w-24 bg-border rounded" />
            <div className="h-40 w-full bg-border rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-28 bg-border rounded-lg" />
              <div className="h-28 bg-border rounded-lg" />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="mt-8 md:mt-0 space-y-6">
          <div className="h-48 bg-border rounded-lg" />
          <div className="h-32 bg-border rounded-lg" />
          <div className="h-40 bg-border rounded-lg" />
          <div className="h-24 bg-border rounded-lg" />
          <div className="h-24 bg-border rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const backNav = (location.state as { from?: string; label?: string } | null);
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven sheet state — single ?sheet=<type> discriminated union
  const sheet = searchParams.get('sheet');
  const sheetInvoiceId = searchParams.get('invoiceId');
  const sheetContactId = searchParams.get('contactId');
  const sheetTemplateType = searchParams.get('templateType') ?? undefined;
  const sheetIsDeposit = searchParams.get('isDeposit') === 'true';
  const sheetAmount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;
  const sheetDescription = searchParams.get('description') ?? undefined;
  const sheetSeriesId = searchParams.get('seriesId') ?? null;
  const sheetWarning = searchParams.get('warning') ?? '';
  const sheetContractReadOnly = searchParams.get('readOnly') === 'true';

  // pendingContract: a full Contract object from createContract callback — not URL-serializable
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);
  // selectedSeriesId: transient form input within the series selector dialog
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  // viewingMusicFormResponse: lazy-loads the music form response query
  const [viewingMusicFormResponse, setViewingMusicFormResponse] = useState(false);

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
  const contractActions = useContractActions(id!);
  const invoiceActions = useInvoiceActions(id!);
  const fields = useBookingFields(id!);
  const {
    checklist,
    checklistLoading,
    readyDialogStatus,
    celebratoryTitle,
    dismissReadyDialog,
    confirmStatusTransition,
    toggleItem,
    addItem,
    isAddingItem,
  } = useBookingChecklist(id!, booking, isLoaded);
  const queryClient = useQueryClient();
  const { data: seriesBookings = [], isLoading: seriesBookingsLoading } = useSeriesBookings(booking?.series?.id);

  const { data: seriesList } = useQuery({
    queryKey: ['series'],
    queryFn: () => apiGet<BookingSeries[]>('/series'),
    enabled: isLoaded && sheet === 'series',
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

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function openCompose(templateType?: string) {
    setSearchParams(templateType ? { sheet: 'compose', templateType } : { sheet: 'compose' });
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
    const params: Record<string, string> = { sheet: 'invoice', isDeposit: String(prefill?.isDeposit ?? false) };
    if (prefill?.amount != null) params.amount = String(prefill.amount);
    const desc = buildSetsDescription();
    if (desc) params.description = desc;
    setSearchParams(params);
  }

  function openEditInvoice(invoice: Invoice) {
    setSearchParams({ sheet: 'invoice', invoiceId: invoice.id });
  }

  function openSendInvoice(invoice: Invoice) {
    const templateType = invoice.isDeposit ? 'deposit_invoice_cover' : 'balance_invoice_cover';
    openCompose(templateType);
  }

  function handleChecklistAction(action: 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract') {
    if (action === 'create_contract') {
      contractActions.createContract((contract) => {
        setPendingContract(contract);
        setSearchParams({ sheet: 'contract' });
      });
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
      if (sentDeposit) invoiceActions.markPaid(sentDeposit.id);
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

  const defaultTab: 'checklist' | 'onTheDay' =
    booking.status === 'ENQUIRY' || booking.status === 'PROVISIONAL' || booking.status === 'CONFIRMED'
      ? 'checklist'
      : 'onTheDay';

  const editSection = (section: string) => setSearchParams({ sheet: 'bookingEdit', section });

  const downloadDoc = async (url: string, filename: string) => {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = window.document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Derive sheet-specific data from URL params + loaded data
  const editingInvoice = sheet === 'invoice' && sheetInvoiceId
    ? invoices.find((inv) => inv.id === sheetInvoiceId)
    : undefined;
  const invoiceSheetPrefill = sheet === 'invoice' && !sheetInvoiceId && searchParams.has('isDeposit')
    ? { isDeposit: sheetIsDeposit, amount: sheetAmount, description: sheetDescription }
    : undefined;
  const markSentInvoice = sheet === 'markSent' && sheetInvoiceId
    ? invoices.find((inv) => inv.id === sheetInvoiceId)
    : undefined;
  const editingContact = sheet === 'contactEdit' && sheetContactId
    ? ([booking.customer, booking.bookingAgent, booking.venue].find((c) => c?.id === sheetContactId) ?? null)
    : null;

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

      {/* ─── Overview strip (always visible) ─── */}
      <section className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/booking/${booking.portalToken}?preview=admin&from=${backUrl}`}
              className="inline-flex items-center justify-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors border border-border rounded h-9 w-9 md:w-auto md:px-3"
            >
              <Eye size={16} />
              <span className="hidden md:inline">Client portal</span>
            </a>
            <Button
              variant="outline"
              size="sm"
              className="w-9 px-0 md:w-auto md:px-3"
              onClick={() => setSearchParams({ sheet: 'bookingEdit' })}
            >
              <Pencil size={16} />
              <span className="hidden md:inline">Edit</span>
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between md:flex-wrap md:justify-start md:gap-x-3 md:gap-y-1 mt-2">
          <BookingStatusDropdown
            currentStatus={booking.status}
            checklist={checklist}
            onStatusChange={(status) => fields.updateStatus(status)}
            isPending={fields.isStatusPending}
          />
          <span className="text-sm text-muted">{formatDate(booking.date)}</span>
          {feeWithVat
            ? <span className="text-sm text-muted">{feeWithVat}</span>
            : <InlineFeeAdd onSave={(fee) => fields.updateFee(fee)} isSaving={fields.isFeePending} />
          }
          {booking.series ? (
            <span className="hidden md:inline-flex items-center gap-1.5 text-sm text-foreground border border-border rounded-full px-3 py-1.5">
              {booking.series.label}
              <button
                type="button"
                onClick={() => fields.updateSeries({ seriesId: null })}
                className="hover:text-foreground transition-colors"
                aria-label="Remove from series"
              >
                <X size={12} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setSearchParams({ sheet: 'series' })}
              className="hidden md:inline text-sm text-muted hover:text-foreground transition-colors underline underline-offset-2"
            >
              + Add to series
            </button>
          )}
        </div>
      </section>

      {/* ─── Mobile tabs ─── */}
      <div className="md:hidden">
      <BookingDetailTabs
        defaultTab={defaultTab}
        checklist={
          booking.status !== 'CANCELLED' ? (
            <ChecklistSection
              items={checklist}
              isLoading={checklistLoading}
              bookingStatus={booking.status}
              onToggle={(itemId, state) => toggleItem(itemId, state)}
              onChecklistAction={handleChecklistAction}
              onOpenCompose={openCompose}
              onMarkDone={handleMarkDone}
              onAddItem={(data) => addItem(data)}
              isAddingItem={isAddingItem}
              isActionPending={actions.isPending || invoiceActions.isMarkingPaid}
              hideHeader
            />
          ) : null
        }
        onTheDay={
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ItineraryCard
                logistics={booking.logistics}
                sets={booking.sets}
                onEdit={() => editSection('onTheDay')}
                hideWhenEmpty
              />
              <DetailsCard
                logistics={booking.logistics}
                onEdit={() => editSection('onTheDay')}
                hideWhenEmpty
              />
            </div>
            {booking.venue && (
              <VenueMapWidget
                venue={booking.venue}
                showHeader={true}
                cardTitle="Venue"
                cardAction={
                  <button type="button" onClick={() => setSearchParams({ sheet: 'contactEdit', contactId: booking.venue!.id })} className="text-xs text-primary hover:text-primary/80 transition-colors">
                    Edit
                  </button>
                }
                contactHref={`/admin/contacts/${booking.venue.id}`}
                travelTime={venueTravelTime}
                isLoadingTravelTime={isFetchingTravelTime}
                onRefreshTravelTime={() => queryClient.invalidateQueries({ queryKey: ['contact-travel-time', bookingVenueId] })}
              />
            )}
            <InlineNotes
              notes={booking.notes}
              onSave={(notes) => fields.updateNotes(notes)}
              isSaving={fields.isNotesPending}
            />
          </div>
        }
        info={
          <div className="space-y-6 pt-2">
            <section>
              <SectionHeader label="People" />
              <div className="flex flex-row gap-4">
                <PersonChip role="Customer" contact={booking.customer} linkState={backState} onEdit={() => setSearchParams({ sheet: 'contactEdit', contactId: booking.customer.id })} />
                {booking.bookingAgent && (
                  <PersonChip
                    role="Booking agent"
                    contact={booking.bookingAgent}
                    linkState={backState}
                    onEdit={() => setSearchParams({ sheet: 'contactEdit', contactId: booking.bookingAgent!.id })}
                  />
                )}
              </div>
            </section>

            {booking.series && (
              <section>
                <SectionHeader label="Series" />
                <span className="inline-flex items-center gap-1.5 text-sm text-foreground border border-border rounded-full px-3 py-1.5">
                  {booking.series.label}
                  <button
                    type="button"
                    onClick={() => fields.updateSeries({ seriesId: null })}
                    className="hover:text-foreground transition-colors"
                    aria-label="Remove from series"
                  >
                    <X size={12} />
                  </button>
                </span>
              </section>
            )}

            {booking.series && (
              <SeriesEventsCard
                bookings={seriesBookings.filter((b) => b.id !== booking.id)}
                isLoading={seriesBookingsLoading}
                onAddToSeries={() => navigate('/admin/bookings/new', { state: { seriesId: booking.series!.id } })}
              />
            )}

            {booking.status !== 'CANCELLED' && (
              <ContractCard
                booking={booking}
                documents={documents}
                isCreating={contractActions.isCreatingContract}
                onCreateContract={() => contractActions.createContract((contract) => {
                  setPendingContract(contract);
                  setSearchParams({ sheet: 'contract' });
                })}
                onEdit={() => setSearchParams({ sheet: 'contract' })}
                onPreview={() => setSearchParams({ sheet: 'contract', readOnly: 'true' })}
                onSend={() => openCompose(contractShortcutType)}
                onVoid={(confirmSignedVoid) => {
                  const contractId = booking.activeContract?.id;
                  if (contractId) contractActions.voidContract({ contractId, confirmSignedVoid });
                }}
                onDelete={() => {
                  const contractId = booking.activeContract?.id;
                  if (contractId) contractActions.deleteContract(contractId);
                }}
              />
            )}

            {booking.series ? (
              <SeriesInvoiceCard
                seriesId={booking.series.id}
                seriesLabel={booking.series.label}
                onEdit={(inv) => openEditInvoice(inv as unknown as Invoice)}
                onSend={() => openCompose('balance_invoice_cover')}
                onMarkSent={(inv) => setSearchParams({ sheet: 'markSent', invoiceId: (inv as unknown as Invoice).id })}
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
                onMarkSent={(inv) => setSearchParams({ sheet: 'markSent', invoiceId: inv.id })}
                onMarkPaid={(inv) => invoiceActions.markPaid(inv.id)}
                onVoid={(inv) => invoiceActions.voidInvoice(inv.id)}
              />
            )}

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
                          onClick={() => downloadDoc(doc.url, filename)}
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

            <section>
              <SectionHeader label="Packages" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PerformanceSection
                  booking={booking}
                  onEdit={() => editSection('packages')}
                  hideWhenEmpty
                />
                <MusicFormSection
                  booking={booking}
                  documents={documents}
                  config={musicFormConfig ?? null}
                  isLoading={musicFormConfigLoading}
                  response={musicFormResponse ?? null}
                  onUpdateConfig={() => editSection('musicForm')}
                  onViewResponse={() => setViewingMusicFormResponse(true)}
                  onEdit={() => editSection('musicForm')}
                  hideWhenEmpty
                />
              </div>
            </section>

            <CommunicationsSection
              communications={communications}
              onCompose={() => openCompose()}
            />
          </div>
        }
      />
      </div>

      {/* ─── Desktop two-column grid ─── */}
      <div className="hidden md:grid md:grid-cols-[3fr_2fr] md:gap-8 md:items-start mt-6">

        {/* ─── Left column top: For the Day + Packages ─── */}
        <div className="space-y-8 md:col-start-1">

          {/* For the day */}
          <section>
            <SectionHeader label="For the day" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <ItineraryCard
                logistics={booking.logistics}
                sets={booking.sets}
                onEdit={() => editSection('onTheDay')}
              />
              <DetailsCard
                logistics={booking.logistics}
                onEdit={() => editSection('onTheDay')}
              />
            </div>
            {booking.venue ? (
              <VenueMapWidget
                venue={booking.venue}
                showHeader={true}
                cardTitle="Venue"
                cardAction={
                  <button type="button" onClick={() => setSearchParams({ sheet: 'contactEdit', contactId: booking.venue!.id })} className="text-xs text-primary hover:text-primary/80 transition-colors">
                    Edit
                  </button>
                }
                contactHref={`/admin/contacts/${booking.venue.id}`}
                travelTime={venueTravelTime}
                isLoadingTravelTime={isFetchingTravelTime}
                onRefreshTravelTime={() => queryClient.invalidateQueries({ queryKey: ['contact-travel-time', bookingVenueId] })}
              />
            ) : (
              <InlineVenueAdd bookingId={booking.id} />
            )}
          </section>

          {/* Packages */}
          <section>
            <SectionHeader label="Packages" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PerformanceSection
                booking={booking}
                onEdit={() => editSection('packages')}
              />
              <MusicFormSection
                booking={booking}
                documents={documents}
                config={musicFormConfig ?? null}
                isLoading={musicFormConfigLoading}
                response={musicFormResponse ?? null}
                onUpdateConfig={() => editSection('musicForm')}
                onViewResponse={() => setViewingMusicFormResponse(true)}
                onEdit={() => editSection('musicForm')}
              />
            </div>
          </section>

        </div>

        {/* ─── Right column ─── */}
        <div className="space-y-6 md:col-start-2 md:row-span-2">

          {/* Checklist */}
          {booking.status !== 'CANCELLED' && (
            <ChecklistSection
              items={checklist}
              isLoading={checklistLoading}
              bookingStatus={booking.status}
              onToggle={(itemId, state) => toggleItem(itemId, state)}
              onChecklistAction={handleChecklistAction}
              onOpenCompose={openCompose}
              onMarkDone={handleMarkDone}
              onAddItem={(data) => addItem(data)}
              isAddingItem={isAddingItem}
              isActionPending={actions.isPending || invoiceActions.isMarkingPaid}
            />
          )}

          {/* People */}
          <section>
            <SectionHeader label="People" />
            <div className="border-t border-border">
              <PersonCard role="Customer" contact={booking.customer} linkState={backState} onEdit={() => setSearchParams({ sheet: 'contactEdit', contactId: booking.customer.id })} />
              {booking.bookingAgent && (
                <PersonCard
                  role="Booking agent"
                  contact={booking.bookingAgent}
                  commissionArrangement={booking.bookingAgent.commissionArrangement}
                  linkState={backState}
                  onEdit={() => setSearchParams({ sheet: 'contactEdit', contactId: booking.bookingAgent!.id })}
                />
              )}
            </div>
          </section>

          {/* Series events */}
          {booking.series && (
            <SeriesEventsCard
              bookings={seriesBookings.filter((b) => b.id !== booking.id)}
              isLoading={seriesBookingsLoading}
              onAddToSeries={() => navigate('/admin/bookings/new', { state: { seriesId: booking.series!.id } })}
            />
          )}

          {/* Contract */}
          {booking.status !== 'CANCELLED' && (
            <ContractCard
              booking={booking}
              documents={documents}
              isCreating={contractActions.isCreatingContract}
              onCreateContract={() => contractActions.createContract((contract) => {
                setPendingContract(contract);
                setSearchParams({ sheet: 'contract' });
              })}
              onEdit={() => setSearchParams({ sheet: 'contract' })}
              onPreview={() => setSearchParams({ sheet: 'contract', readOnly: 'true' })}
              onSend={() => openCompose(contractShortcutType)}
              onVoid={(confirmSignedVoid) => {
                const contractId = booking.activeContract?.id;
                if (contractId) contractActions.voidContract({ contractId, confirmSignedVoid });
              }}
              onDelete={() => {
                const contractId = booking.activeContract?.id;
                if (contractId) contractActions.deleteContract(contractId);
              }}
            />
          )}

          {/* Invoices */}
          {booking.series ? (
            <SeriesInvoiceCard
              seriesId={booking.series.id}
              seriesLabel={booking.series.label}
              onEdit={(inv) => openEditInvoice(inv as unknown as Invoice)}
              onSend={() => openCompose('balance_invoice_cover')}
              onMarkSent={(inv) => setSearchParams({ sheet: 'markSent', invoiceId: (inv as unknown as Invoice).id })}
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
              onMarkSent={(inv) => setSearchParams({ sheet: 'markSent', invoiceId: inv.id })}
              onMarkPaid={(inv) => invoiceActions.markPaid(inv.id)}
              onVoid={(inv) => invoiceActions.voidInvoice(inv.id)}
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
                        onClick={() => downloadDoc(doc.url, filename)}
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

        </div>{/* end right column */}

        {/* ─── Left column bottom: Notes + Communications ─── */}
        <div className="space-y-8 md:col-start-1">

          <InlineNotes
            notes={booking.notes}
            onSave={(notes) => fields.updateNotes(notes)}
            isSaving={fields.isNotesPending}
          />

          <CommunicationsSection
            communications={communications}
            onCompose={() => openCompose()}
          />

        </div>

      </div>{/* end two-column grid */}

      {readyDialogStatus && (
        <Dialog open onOpenChange={dismissReadyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{celebratoryTitle}</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              You've completed all the tasks for this booking. Ready to move it to{' '}
              <span className="font-medium text-foreground">{STATUS_LABELS[readyDialogStatus]}</span>?
            </DialogDescription>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={dismissReadyDialog}>
                Not yet
              </Button>
              <Button onClick={() => confirmStatusTransition(readyDialogStatus)}>
                Mark as {STATUS_LABELS[readyDialogStatus]}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ContractSheet
        bookingId={id!}
        contract={pendingContract ?? booking.activeContract}
        readOnly={sheetContractReadOnly}
        open={sheet === 'contract'}
        onClose={() => { setSearchParams({}); setPendingContract(null); }}
      />
      <BookingEditDrawer booking={booking} />
      <ContactEditSheet
        contact={editingContact}
        onClose={() => setSearchParams({})}
        onUnlink={editingContact?.id === booking.venue?.id ? () => { fields.updateVenue(null); setSearchParams({}); } : undefined}
      />
      <InvoiceSheet
        bookingId={id!}
        invoice={editingInvoice}
        hasDepositInvoice={invoices.some((inv) => inv.isDeposit)}
        prefill={invoiceSheetPrefill}
        open={sheet === 'invoice'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
      />
      <ComposeEmailSheet
        bookingId={id!}
        booking={booking}
        invoices={invoices}
        defaultPaymentTermsDays={userProfile?.defaultPaymentTermsDays}
        open={sheet === 'compose'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
        initialTemplateType={sheet === 'compose' ? sheetTemplateType : undefined}
        onAfterSend={(templateType) => {
          const isContractEmail = templateType === 'contract_cover' || templateType === 'contract_and_deposit_cover';
          const contractId = booking.activeContract?.id;
          if (isContractEmail && contractId && booking.activeContract?.status === 'DRAFT') {
            contractActions.sendContract(contractId);
          }
        }}
      />
      {sheet === 'markSent' && markSentInvoice && (
        <MarkSentDialog
          bookingId={id!}
          invoice={markSentInvoice}
          userProfile={userProfile}
          open={true}
          onOpenChange={(open) => { if (!open) setSearchParams({}); }}
        />
      )}

      {/* Add to series dialog */}
      <Dialog open={sheet === 'series'} onOpenChange={(open) => { if (!open) { setSearchParams({}); setSelectedSeriesId(null); } }}>
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
                onClick={() => {
                  if (selectedSeriesId) {
                    fields.updateSeries({ seriesId: selectedSeriesId }, {
                      onSuccess: (result) => {
                        if (isSeriesConfirmationRequired(result) && selectedSeriesId) {
                          setSearchParams({ sheet: 'customerMismatch', seriesId: selectedSeriesId, warning: result.warning });
                          return;
                        }
                        setSearchParams({});
                        setSelectedSeriesId(null);
                      },
                    });
                  }
                }}
                disabled={!selectedSeriesId || fields.isSeriesPending}
              >
                {fields.isSeriesPending ? 'Saving…' : 'Add to series'}
              </Button>
              <Button variant="outline" onClick={() => { setSearchParams({}); setSelectedSeriesId(null); }}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer mismatch confirmation dialog */}
      <Dialog open={sheet === 'customerMismatch'} onOpenChange={(open) => { if (!open) setSearchParams({ sheet: 'series' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customer mismatch</DialogTitle>
          </DialogHeader>
          <DialogDescription className="pt-2">{sheetWarning}</DialogDescription>
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => {
                if (sheetSeriesId) {
                  fields.updateSeries({ seriesId: sheetSeriesId, confirm: true }, {
                    onSuccess: () => {
                      setSearchParams({});
                      setSelectedSeriesId(null);
                    },
                  });
                }
              }}
              disabled={fields.isSeriesPending}
            >
              {fields.isSeriesPending ? 'Saving…' : 'Continue anyway'}
            </Button>
            <Button variant="outline" onClick={() => setSearchParams({ sheet: 'series' })}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
