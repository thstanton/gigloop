import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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
import { BookingHeader } from '@/features/bookings/BookingHeader';
import { BookingPeople } from '@/features/bookings/BookingPeople';
import { BookingForTheDay } from '@/features/bookings/BookingForTheDay';
import { BookingRightColumn } from '@/features/bookings/BookingRightColumn';
import BookingEditDrawer from '@/features/bookings/BookingEditDrawer';
import ContractSheet from '@/features/bookings/ContractSheet';
import ContactEditSheet from '@/features/contacts/ContactEditSheet';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import InlineNotes from '@/features/bookings/InlineNotes';
import { apiGet } from '@/lib/api';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
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
  const hasDepositItem = checklist.some((item) => item.key === 'deposit_received');
  const contractShortcutType = hasDepositItem ? 'contract_and_deposit_cover' : 'contract_cover';
  const backState = { from: `/admin/bookings/${id}`, label: title };

  function handleVoidContract(confirmSignedVoid: boolean) {
    const contractId = booking?.activeContract?.id;
    if (contractId) voidContract({ contractId, confirmSignedVoid });
  }

  function handleDeleteContract() {
    const contractId = booking?.activeContract?.id;
    if (contractId) deleteContract(contractId);
  }

  function handleAfterSend(templateType: string | null) {
    if (!templateType) return;
    const isContractEmail = templateType === 'contract_cover' || templateType === 'contract_and_deposit_cover';
    const contractId = booking?.activeContract?.id;
    if (isContractEmail && contractId && booking?.activeContract?.status === 'DRAFT') {
      sendContract(contractId);
    }
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">
      <Link
        to={backNav?.from ?? '/admin/bookings'}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        {backNav?.label ?? 'Bookings'}
      </Link>

      <div className="mt-6 md:grid md:grid-cols-[3fr_2fr] md:gap-8 md:items-start">
        <div className="space-y-8">
          <BookingHeader
            booking={booking}
            checklist={checklist}
            userProfile={userProfile}
            onStatusChange={fields.updateStatus}
            isStatusPending={fields.isStatusPending}
            onFeeAdd={fields.updateFee}
            isFeePending={fields.isFeePending}
            onEdit={() => setSearchParams({ edit: 'true' })}
          />
          <BookingPeople
            booking={booking}
            linkState={backState}
            onEdit={setEditingContact}
          />
          <InlineNotes
            notes={booking.notes}
            onSave={fields.updateNotes}
            isSaving={fields.isNotesPending}
          />
          <BookingForTheDay
            booking={booking}
            documents={documents}
            musicFormConfig={musicFormConfig ?? null}
            musicFormConfigLoading={musicFormConfigLoading}
            musicFormResponse={musicFormResponse ?? null}
            linkState={backState}
            onEditVenue={setEditingContact}
            onEditPerformance={() => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('edit', 'true'); n.set('section', 'performance'); return n; })}
            onUpdateMusicFormConfig={() => configureMusicForm.mutate()}
            onViewMusicFormResponse={() => setViewingMusicFormResponse(true)}
            onEditMusicForm={() => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('edit', 'true'); n.set('section', 'musicForm'); return n; })}
          />
        </div>

        <BookingRightColumn
          booking={booking}
          invoices={invoices}
          documents={documents}
          communications={communications}
          checklist={checklist}
          checklistLoading={checklistLoading}
          contractShortcutType={contractShortcutType}
          isCreatingContract={isCreatingContract}
          invoicesPending={invoicesPending}
          isAddingItem={isAddingItem}
          isActionPending={actions.isPending || isMarkingPaid}
          onToggleChecklist={toggleItem}
          onChecklistAction={handleChecklistAction}
          onOpenCompose={openCompose}
          onMarkDone={handleMarkDone}
          onAddItem={addItem}
          onCreateContract={createContract}
          onEditContract={() => setContractSheetState({ readOnly: false })}
          onPreviewContract={() => setContractSheetState({ readOnly: true })}
          onSendContract={() => openCompose(contractShortcutType)}
          onVoidContract={handleVoidContract}
          onDeleteContract={handleDeleteContract}
          onNewDepositInvoice={() => openCreateInvoice(buildInvoicePrefill(booking, userProfile, true))}
          onNewBalanceInvoice={() => openCreateInvoice(buildInvoicePrefill(booking, userProfile, false))}
          onEditInvoice={openEditInvoice}
          onDeleteInvoice={(inv) => actions.deleteInvoice(inv.id)}
          onSendInvoice={openSendInvoice}
          onMarkSentInvoice={setMarkSentInvoice}
          onMarkPaidInvoice={(inv) => markPaid(inv.id)}
          onVoidInvoice={(inv) => voidInvoice(inv.id)}
          onCompose={openCompose}
        />
      </div>

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
              <Button variant="outline" onClick={dismissReadyDialog}>Not yet</Button>
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
        onAfterSend={handleAfterSend}
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
