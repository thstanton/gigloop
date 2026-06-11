import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Eye, Pencil, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import ContractCard from '@/features/bookings/ContractCard';
import { DocumentsCard } from '@/features/bookings/DocumentsCard';
import InvoiceSection from '@/features/bookings/InvoiceSection';
import { BookingDetailSheets } from '@/features/bookings/BookingDetailSheets';
import { BookingDetailDesktop } from '@/features/bookings/BookingDetailDesktop';
import { BookingVenueMapWidget } from '@/features/bookings/BookingVenueMapWidget';
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
import { apiGet } from '@/lib/api';
import {
  formatDate,
  formatCurrency,
  formatFee,
} from '@/lib/formatters';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import { SectionHeader } from '@/components/common/SectionHeader';
import type {
  Contract,
  Invoice,
  MusicFormConfig,
  UserProfile,
} from '@/types/api';

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
  const [, setSearchParams] = useSearchParams();

  // pendingContract: a full Contract object from createContract callback — not URL-serializable
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);

  const { isLoaded } = useAuth();
  const { data: booking, isLoading, isError } = useBooking(id!);
  const { data: invoices = [] } = useBookingInvoices(id!);
  const { data: communications = [] } = useBookingCommunications(id!);
  const { data: documents = [] } = useBookingDocuments(id!);
  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
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
  const { data: seriesBookings = [], isLoading: seriesBookingsLoading } = useSeriesBookings(booking?.series?.id);

  const { data: musicFormConfig, isLoading: musicFormConfigLoading } = useQuery({
    queryKey: ['booking-music-form-config', id],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${id}/music-form-config`),
    enabled: isLoaded && !!booking && booking.hasMusicFormConfig,
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

  const defaultTab: 'checklist' | 'onTheDay' =
    booking.status === 'ENQUIRY' || booking.status === 'PROVISIONAL' || booking.status === 'CONFIRMED'
      ? 'checklist'
      : 'onTheDay';

  const editSection = (section: string) => setSearchParams({ sheet: 'bookingEdit', section });

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
            <BookingVenueMapWidget
              bookingId={id!}
              contactHref={`/admin/contacts/${booking.venue?.id ?? ''}`}
            />
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
              <InvoiceSection bookingId={id!} />
            )}

            <DocumentsCard bookingId={id!} />

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
                  onUpdateConfig={() => editSection('musicForm')}
                  onEdit={() => editSection('musicForm')}
                  hideWhenEmpty
                />
              </div>
            </section>

            <CommunicationsSection
              communications={communications}
            />
          </div>
        }
      />
      </div>

      <BookingDetailDesktop
        bookingId={id!}
        onCreateContract={(contract) => setPendingContract(contract)}
      />

      <BookingDetailSheets
        bookingId={id!}
        pendingContract={pendingContract}
        onPendingContractClear={() => setPendingContract(null)}
        readyDialogStatus={readyDialogStatus}
        celebratoryTitle={celebratoryTitle}
        dismissReadyDialog={dismissReadyDialog}
        confirmStatusTransition={confirmStatusTransition}
      />
    </div>
  );
}
