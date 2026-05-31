import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Check, X, MapPin } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingActions } from '@/lib/hooks/useBookingActions';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import { useBookingCommunications } from '@/lib/hooks/useBookingCommunications';
import { useBookingDocuments } from '@/lib/hooks/useBookingDocuments';
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useInvoiceActions } from '@/lib/hooks/useInvoiceActions';
import { useConfigureMusicForm } from '@/lib/hooks/useConfigureMusicForm';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import BookingEditDrawer from '@/features/bookings/BookingEditDrawer';
import ContactPicker from '@/features/bookings/ContactPicker';
import ContractSheet from '@/features/bookings/ContractSheet';
import ContactEditSheet from '@/features/contacts/ContactEditSheet';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import ContractCard from '@/features/bookings/ContractCard';
import InvoiceSection from '@/features/bookings/InvoiceSection';
import VenueCard from '@/features/bookings/VenueCard';
import PersonCard from '@/features/bookings/PersonCard';
import CommunicationsSection from '@/features/bookings/CommunicationsSection';
import PerformanceSection from '@/features/bookings/PerformanceSection';
import MusicFormSection from '@/features/bookings/MusicFormSection';
import ChecklistSection from '@/features/bookings/ChecklistSection';
import BookingStatusDropdown from '@/features/bookings/BookingStatusDropdown';
import InlineNotes from '@/features/bookings/InlineNotes';
import InlineFeeAdd from '@/features/bookings/InlineFeeAdd';
import { DocumentList } from '@/features/bookings/DocumentList';
import { apiGet, apiPatch } from '@/lib/api';
import {
  formatDate,
  formatCurrency,
  formatFee,
} from '@/lib/formatters';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { IconButton } from '@/components/common/IconButton';
import { EmptyState } from '@/components/common/EmptyState';
import type {
  BookingDetail,
  BookingStatus,
  Contact,
  Invoice,
  MusicFormConfig,
  MusicFormResponse,
  Template,
  UserProfile,
} from '@/types/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSetsDescription(booking: BookingDetail | undefined): string {
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

function buildInvoicePrefill(
  booking: BookingDetail,
  userProfile: UserProfile | undefined,
  isDeposit: boolean,
): { isDeposit: boolean; amount?: number } {
  const fee = booking.fee ? parseFloat(booking.fee) : null;
  const pct = userProfile?.depositPercentage;
  const multiplier = isDeposit ? pct! / 100 : 1 - pct! / 100;
  const amount = fee && pct ? Math.round(fee * multiplier * 100) / 100 : undefined;
  return { isDeposit, amount };
}

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

  if (!editing) {
    return (
      <EmptyState
        icon={<MapPin size={32} />}
        heading="No venue"
        description="Link a venue contact to this booking."
        action={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-primary hover:underline"
          >
            + Add venue
          </button>
        }
      />
    );
  }

  return (
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

  const [composeTemplateType, setComposeTemplateType] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
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

  const actions = useBookingActions(id!);
  const fields = useBookingFields(id!);

  const {
    checklist, checklistLoading,
    readyDialogStatus, celebratoryTitle,
    dismissReadyDialog, confirmStatusTransition,
    toggleItem, addItem, isAddingItem,
  } = useBookingChecklist(id!, booking, isLoaded);

  const {
    contractSheetState, setContractSheetState,
    createContract, isCreatingContract,
    sendContract, voidContract, deleteContract,
  } = useContractActions(id!);

  const {
    invoiceSheetState, setInvoiceSheetState,
    markSentInvoice, setMarkSentInvoice,
    voidInvoice, markPaid, isMarkingPaid,
  } = useInvoiceActions(id!);

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

  const configureMusicForm = useConfigureMusicForm(id!, booking, () => {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('edit', 'true'); return next; });
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function openCompose(templateType?: string) {
    setComposeTemplateType(templateType ?? '');
  }

  function openCreateInvoice(prefill?: { isDeposit: boolean; amount?: number }) {
    setInvoiceSheetState({ prefill: prefill ? { ...prefill, description: buildSetsDescription(booking) } : undefined });
  }

  function openEditInvoice(invoice: Invoice) {
    setInvoiceSheetState({ invoice });
  }

  function openSendInvoice(invoice: Invoice) {
    openCompose(invoice.isDeposit ? 'deposit_invoice_cover' : 'balance_invoice_cover');
  }

  function handleChecklistAction(action: 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract') {
    if (action === 'create_contract') {
      createContract();
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
      if (sentDeposit) markPaid(sentDeposit.id);
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
                  href={`/booking/${booking.portalToken}?preview=admin&from=${encodeURIComponent(`/admin/bookings/${booking.id}`)}`}
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
                onStatusChange={fields.updateStatus}
                isPending={fields.isStatusPending}
              />
              <span className="text-sm text-muted">{formatDate(booking.date)}</span>
              {feeWithVat
                ? <span className="text-sm text-muted">{feeWithVat}</span>
                : <InlineFeeAdd onSave={fields.updateFee} isSaving={fields.isFeePending} />
              }
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
            onSave={fields.updateNotes}
            isSaving={fields.isNotesPending}
          />

          {/* 4. For the day */}
          <section>
            <SectionHeader label="For the day" />
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
              {booking.venue
                ? <VenueCard venue={booking.venue} linkState={backState} onEdit={() => setEditingContact(booking.venue!)} />
                : <InlineVenueAdd bookingId={booking.id} />
              }
              <div className={booking.venue ? 'sm:col-span-2' : undefined}>
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
              onToggle={toggleItem}
              onChecklistAction={handleChecklistAction}
              onOpenCompose={openCompose}
              onMarkDone={handleMarkDone}
              onAddItem={addItem}
              isAddingItem={isAddingItem}
              isActionPending={actions.isPending || isMarkingPaid}
            />
          )}

          {/* Contract */}
          {booking.status !== 'CANCELLED' && (
            <ContractCard
              booking={booking}
              documents={documents}
              isCreating={isCreatingContract}
              onCreateContract={createContract}
              onEdit={() => setContractSheetState({ readOnly: false })}
              onPreview={() => setContractSheetState({ readOnly: true })}
              onSend={() => openCompose(contractShortcutType)}
              onVoid={(confirmSignedVoid) => {
                const contractId = booking.activeContract?.id;
                if (contractId) voidContract({ contractId, confirmSignedVoid });
              }}
              onDelete={() => {
                const contractId = booking.activeContract?.id;
                if (contractId) deleteContract(contractId);
              }}
            />
          )}

          {/* Invoices */}
          <InvoiceSection
            invoices={invoices}
            documents={documents}
            isPending={invoicesPending}
            onNewDepositInvoice={() => openCreateInvoice(buildInvoicePrefill(booking, userProfile, true))}
            onNewBalanceInvoice={() => openCreateInvoice(buildInvoicePrefill(booking, userProfile, false))}
            onEdit={openEditInvoice}
            onDelete={(inv) => actions.deleteInvoice(inv.id)}
            onSend={openSendInvoice}
            onMarkSent={setMarkSentInvoice}
            onMarkPaid={(inv) => markPaid(inv.id)}
            onVoid={(inv) => voidInvoice(inv.id)}
          />

          {/* Documents */}
          <Card title="Documents">
            <DocumentList documents={documents} invoices={invoices} />
          </Card>

          {/* Communications */}
          <CommunicationsSection
            communications={communications}
            onCompose={() => openCompose()}
          />

        </div>{/* end right column */}
      </div>{/* end two-column grid */}

      {readyDialogStatus && (
        <Dialog open onOpenChange={dismissReadyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{celebratoryTitle}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted">
              You've completed all the tasks for this booking. Ready to move it to{' '}
              <span className="font-medium text-foreground">{STATUS_LABELS[readyDialogStatus]}</span>?
            </p>
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
        contract={contractSheetState?.contract ?? booking.activeContract}
        readOnly={contractSheetState?.readOnly ?? false}
        open={contractSheetState !== null}
        onClose={() => setContractSheetState(null)}
      />
      <BookingEditDrawer booking={booking} />
      <ContactEditSheet contact={editingContact} onClose={() => setEditingContact(null)} />
      <InvoiceSheet
        bookingId={id!}
        invoice={invoiceSheetState?.invoice}
        hasDepositInvoice={invoices.some((inv) => inv.isDeposit)}
        prefill={invoiceSheetState?.prefill}
        open={invoiceSheetState !== null}
        onOpenChange={(open) => { if (!open) setInvoiceSheetState(null); }}
      />
      <ComposeEmailSheet
        bookingId={id!}
        booking={booking}
        invoices={invoices}
        defaultPaymentTermsDays={userProfile?.defaultPaymentTermsDays}
        open={composeTemplateType !== null}
        onOpenChange={(open) => { if (!open) setComposeTemplateType(null); }}
        initialTemplateType={composeTemplateType || undefined}
        onAfterSend={(templateType) => {
          const isContractEmail = templateType === 'contract_cover' || templateType === 'contract_and_deposit_cover';
          const contractId = booking.activeContract?.id;
          if (isContractEmail && contractId && booking.activeContract?.status === 'DRAFT') {
            sendContract(contractId);
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
    </div>
  );
}
