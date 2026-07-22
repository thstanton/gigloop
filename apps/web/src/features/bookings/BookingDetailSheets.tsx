import { useAuth } from '@clerk/react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { BOOKING_STATUS_LABELS } from '@/lib/constants';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { useCopyBooking } from '@/lib/hooks/useCopyBooking';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import { isDepositPercentageHintEligible } from '@/lib/invoiceDerivations';
import { CopyEventDialog } from '@/features/bookings/CopyEventDialog';
import ContractSheet from '@/features/bookings/ContractSheet';
import ContactEditSheet from '@/features/contacts/ContactEditSheet';
import { VenueQuickTweakSheet } from '@/features/bookings/VenueQuickTweakSheet';
import { PeopleQuickTweakSheet } from '@/features/bookings/PeopleQuickTweakSheet';
import { DetailsQuickTweakSheet } from '@/features/bookings/DetailsQuickTweakSheet';
import { ItineraryQuickTweakSheet } from '@/features/bookings/ItineraryQuickTweakSheet';
import { OverviewQuickTweakSheet } from '@/features/bookings/OverviewQuickTweakSheet';
import { MusicQuickTweakSheet } from '@/features/bookings/MusicQuickTweakSheet';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import { apiGet } from '@/lib/api';
import type {
  Template,
  UserProfile,
} from '@/types/api';


interface BookingDetailSheetsProps {
  bookingId: string;
}

export function BookingDetailSheets({ bookingId }: BookingDetailSheetsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sheet = searchParams.get('sheet');

  const sheetInvoiceId = searchParams.get('invoiceId');
  const sheetContactId = searchParams.get('contactId');
  const sheetTemplateType = searchParams.get('templateType') ?? undefined;
  const sheetIsDeposit = searchParams.get('isDeposit') === 'true';
  const sheetAmount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;
  const sheetDescription = searchParams.get('description') ?? undefined;
  const sheetContractReadOnly = searchParams.get('readOnly') === 'true';

  const { isLoaded } = useAuth();
  const { data: booking } = useBooking(bookingId);
  const {
    readyDialogStatus,
    celebratoryTitle,
    dismissReadyDialog,
    confirmStatusTransition,
    isConfirmingTransition,
  } = useBookingChecklist(bookingId, booking, isLoaded);

  const { data: invoices = [] } = useBookingInvoices(bookingId);
  const contractActions = useContractActions(bookingId);
  const fields = useBookingFields(bookingId);
  const copy = useCopyBooking(bookingId);

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  useQuery({
    queryKey: ['templates'],
    queryFn: () => apiGet<Template[]>('/templates'),
    enabled: isLoaded,
    staleTime: 5 * 60 * 1000,
  });

  if (!booking) return null;

  const editingInvoice = sheet === 'invoice' && sheetInvoiceId
    ? invoices.find((inv) => inv.id === sheetInvoiceId)
    : undefined;
  const invoiceSheetPrefill = sheet === 'invoice' && !sheetInvoiceId && searchParams.has('isDeposit')
    ? { isDeposit: sheetIsDeposit, amount: sheetAmount, description: sheetDescription }
    : undefined;
  // #758: computed here (not in InvoiceSheet) because neither the fee nor the profile setting is
  // in the sheet's scope. The sheet decides whether to *show* it (create mode + deposit toggle on).
  const depositPercentageHintEligible = isDepositPercentageHintEligible(booking.fee, userProfile);
  const markSentInvoice = sheet === 'markSent' && sheetInvoiceId
    ? invoices.find((inv) => inv.id === sheetInvoiceId)
    : undefined;
  const editingContact = sheet === 'contactEdit' && sheetContactId
    ? ([booking.customer, booking.bookingAgent, booking.venue].find((c) => c?.id === sheetContactId) ?? null)
    : null;

  return (
    <>
      {readyDialogStatus && (
        <ResponsiveDialog open onOpenChange={dismissReadyDialog}>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle className="font-display text-xl">{celebratoryTitle}</ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <ResponsiveDialogDescription className="mt-2">
              You've completed all the tasks for this booking. Ready to move it to{' '}
              <span className="font-medium text-foreground">{BOOKING_STATUS_LABELS[readyDialogStatus]}</span>?
            </ResponsiveDialogDescription>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={dismissReadyDialog} disabled={isConfirmingTransition}>
                Not yet
              </Button>
              <Button onClick={() => confirmStatusTransition(readyDialogStatus)} disabled={isConfirmingTransition}>
                {isConfirmingTransition ? 'Saving…' : `Mark as ${BOOKING_STATUS_LABELS[readyDialogStatus]}`}
              </Button>
            </div>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      )}

      <ContractSheet
        bookingId={bookingId}
        readOnly={sheetContractReadOnly}
        open={sheet === 'contract'}
        onClose={() => { setSearchParams({}); }}
      />
      <ContactEditSheet
        contact={editingContact}
        onClose={() => { setSearchParams({}); }}
        onUnlink={editingContact?.id === booking.venue?.id ? () => { fields.updateVenue(null); setSearchParams({}); } : undefined}
      />
      <VenueQuickTweakSheet
        bookingId={bookingId}
        currentVenueId={booking.venue?.id ?? null}
        open={sheet === 'venueTweak'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
      />
      <PeopleQuickTweakSheet
        bookingId={bookingId}
        currentCustomerId={booking.customer?.id ?? null}
        currentAgentId={booking.bookingAgent?.id ?? null}
        open={sheet === 'peopleTweak'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
      />
      <DetailsQuickTweakSheet
        bookingId={bookingId}
        currentLogistics={booking.logistics}
        open={sheet === 'detailsTweak'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
      />
      <ItineraryQuickTweakSheet
        bookingId={bookingId}
        eventType={booking.eventType}
        sets={booking.sets}
        packages={booking.packages}
        currentLogistics={booking.logistics}
        open={sheet === 'itineraryTweak'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
      />
      <OverviewQuickTweakSheet
        bookingId={bookingId}
        initialEventType={booking.eventType}
        initialDate={booking.date.slice(0, 10)}
        initialFee={booking.fee}
        initialTitle={booking.title}
        initialSeriesId={booking.seriesId}
        open={sheet === 'overviewTweak'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
      />
      <MusicQuickTweakSheet
        bookingId={bookingId}
        hasMusicFormConfig={booking.hasMusicFormConfig}
        packages={booking.packages}
        open={sheet === 'musicTweak'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
        // #632: publishing chains into the send-invite compose sheet (mirrors invoice issue → send).
        onPublished={() => setSearchParams({ sheet: 'compose', templateType: 'music_form_invite' })}
      />
      <InvoiceSheet
        bookingId={bookingId}
        invoice={editingInvoice}
        hasDepositInvoice={invoices.some((inv) => inv.isDeposit)}
        prefill={invoiceSheetPrefill}
        depositPercentageHintEligible={depositPercentageHintEligible}
        open={sheet === 'invoice'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
        onAfterIssue={(inv) => {
          const templateType = inv.isDeposit ? 'deposit_invoice_cover' : 'balance_invoice_cover';
          setSearchParams({ sheet: 'compose', templateType });
        }}
      />
      <ComposeEmailSheet
        bookingId={bookingId}
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
          bookingId={bookingId}
          invoice={markSentInvoice}
          userProfile={userProfile}
          open={true}
          onOpenChange={(open) => { if (!open) setSearchParams({}); }}
        />
      )}

      {sheet === 'copyEvent' && (
        <CopyEventDialog
          open
          onOpenChange={(open) => { if (!open) setSearchParams({}); }}
          onCopy={(date) => copy.copyBooking(date)}
          isPending={copy.isPending}
        />
      )}

    </>
  );
}
