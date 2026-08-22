import { useEffect, useMemo } from 'react';
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
import { useCopyBooking } from '@/lib/hooks/useCopyBooking';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import { useInvoice } from '@/lib/hooks/useInvoice';
import { useSeriesInvoice } from '@/lib/hooks/useSeriesInvoice';
import { isDepositPercentageHintEligible, depositAmount, coverTemplateFor } from '@/lib/invoiceDerivations';
import { buildSetsDescription } from '@/lib/bookingSets';
import { CopyEventDialog } from '@/features/bookings/CopyEventDialog';
import ContractSheet from '@/features/bookings/ContractSheet';
import { VenueQuickTweakSheet } from '@/features/bookings/VenueQuickTweakSheet';
import { PeopleQuickTweakSheet } from '@/features/bookings/PeopleQuickTweakSheet';
import { DetailsQuickTweakSheet } from '@/features/bookings/DetailsQuickTweakSheet';
import { ItineraryQuickTweakSheet } from '@/features/bookings/ItineraryQuickTweakSheet';
import { BandSheet } from '@/features/bookings/BandSheet';
import { OverviewQuickTweakSheet } from '@/features/bookings/OverviewQuickTweakSheet';
import { MusicQuickTweakSheet } from '@/features/bookings/MusicQuickTweakSheet';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import type { SeriesComposeTarget } from '@/features/communications/composeHelpers';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import { apiGet } from '@/lib/api';
import { isEnabled } from '@/lib/featureFlags';
import { toast } from '@/lib/hooks/use-toast';
import type {
  BookingDetail,
  Invoice,
  Template,
  UserProfile,
} from '@/types/api';


interface BookingDetailSheetsProps {
  bookingId: string;
}

// #757 Hint B target: the deposit-invoice sheet, pre-filled exactly like the "Add invoice" menu
// (InvoiceSection.openCreateInvoice) — deposit flag, fee × default-% amount, and the sets description.
function buildCreateDepositHref(
  bookingId: string,
  booking: BookingDetail,
  depositPercentage: number | null | undefined,
): string {
  const params = new URLSearchParams({ sheet: 'invoice', isDeposit: 'true' });
  if (booking.fee && depositPercentage) {
    params.set('amount', String(depositAmount(parseFloat(booking.fee), depositPercentage)));
  }
  const desc = buildSetsDescription(booking);
  if (desc) params.set('description', desc);
  return `/admin/bookings/${bookingId}?${params.toString()}`;
}

// #847: what the compose sheet needs to send a *series* invoice — the invoice itself plus the
// contact it is billed to, which is the series customer and may not be this member booking's own.
// Undefined until both the series and its active invoice have resolved; the sheet is held shut
// until then, because its template pre-select fires once and cannot be re-run.
function buildSeriesComposeTarget(
  series: { id: string; label: string } | null | undefined,
  invoice: Invoice | null | undefined,
): SeriesComposeTarget | undefined {
  if (!series || !invoice) return undefined;
  return {
    seriesId: series.id,
    seriesLabel: series.label,
    invoice,
    recipient: invoice.billToContact,
  };
}

/**
 * What the compose sheet gets for a series-cover open: the target, and whether it may open at all.
 *
 * `ready` is the gate. The sheet seeds its template selection on the open transition only, so
 * opening before the series invoice has resolved burns that pre-select against a list which does
 * not yet contain the series cover — leaving the musician with an open sheet and nothing selected.
 * On the usual path (Send from the series card) the invoice is already cached, so this only bites
 * on a cold load of the compose URL — which is exactly the case a walkthrough would miss.
 *
 * `ready` false is only ever a *wait*. Once the query settles with no invoice, the effect in the
 * component toasts and clears the URL, so the sheet can never sit silently shut.
 */
function seriesComposeProps(
  composingSeriesInvoice: boolean,
  target: SeriesComposeTarget | undefined,
): { series: SeriesComposeTarget | undefined; ready: boolean } {
  if (!composingSeriesInvoice) return { series: undefined, ready: true };
  return { series: target, ready: !!target };
}

export function BookingDetailSheets({ bookingId }: BookingDetailSheetsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sheet = searchParams.get('sheet');

  const sheetInvoiceId = searchParams.get('invoiceId');
  const sheetTemplateType = searchParams.get('templateType') ?? undefined;
  const sheetIsDeposit = searchParams.get('isDeposit') === 'true';
  const sheetAmount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;
  const sheetDescription = searchParams.get('description') ?? undefined;
  const sheetContractReadOnly = searchParams.get('readOnly') === 'true';

  const { isLoaded } = useAuth();
  const { data: booking } = useBooking(bookingId);
  const {
    checklist,
    readyDialogStatus,
    celebratoryTitle,
    dismissReadyDialog,
    confirmStatusTransition,
    isConfirmingTransition,
  } = useBookingChecklist(bookingId, booking, isLoaded);

  const { data: invoices = [] } = useBookingInvoices(bookingId);
  // ADR-0069 / #844: the invoice a sheet acts on is resolved by id, not by searching the
  // booking's list. That list can never hold a series invoice (`bookingId: null`), so the
  // old `invoices.find(...)` returned undefined for one and InvoiceSheet fell silently into
  // create mode — an empty form where the real line items should have been.
  const { data: sheetInvoice } = useInvoice(sheetInvoiceId);
  // #847: the series invoice a series-cover compose is sent for. `current` is the acted-on
  // invoice by construction — `SeriesService.createInvoice` 409s on a second non-VOID invoice, so
  // a series has at most one — and it shares the query key SeriesInvoiceCard already mounts on
  // this page, so opening the sheet is usually a cache read rather than a fetch.
  const bookingSeries = booking?.series;
  const { data: seriesInvoice, isPending: seriesInvoicePending } = useSeriesInvoice(bookingSeries?.id);
  const composeSeries = useMemo(
    () => buildSeriesComposeTarget(bookingSeries, seriesInvoice),
    [bookingSeries, seriesInvoice],
  );
  const composingSeriesInvoice = sheetTemplateType === 'series_invoice_cover';
  // `isPending` alone would hang on a booking with no series at all: the query is disabled there,
  // so it stays pending forever. No series ⇒ settled, with nothing.
  const seriesInvoiceSettled = !bookingSeries || !seriesInvoicePending;

  // The compose URL is a real address — bookmarkable, refreshable, and reachable after the invoice
  // it names has been voided. The sheet is held shut until its target resolves (see
  // seriesComposeProps), so without this the musician would land here and simply see *nothing*
  // happen. Say so and return them to the booking.
  useEffect(() => {
    if (!composingSeriesInvoice || composeSeries || !seriesInvoiceSettled) return;
    toast({ title: 'No series invoice to send', variant: 'destructive' });
    setSearchParams({});
  }, [composingSeriesInvoice, composeSeries, seriesInvoiceSettled, setSearchParams]);
  const contractActions = useContractActions(bookingId);
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

  const editingInvoice = sheet === 'invoice' && sheetInvoiceId ? sheetInvoice : undefined;
  const invoiceSheetPrefill = sheet === 'invoice' && !sheetInvoiceId && searchParams.has('isDeposit')
    ? { isDeposit: sheetIsDeposit, amount: sheetAmount, description: sheetDescription }
    : undefined;
  // #758: computed here (not in InvoiceSheet) because neither the fee nor the profile setting is
  // in the sheet's scope. The sheet decides whether to *show* it (create mode + deposit toggle on).
  const depositPercentageHintEligible = isDepositPercentageHintEligible(booking.fee, userProfile);

  // #757 Hint A: create the contract then open its editor — byte-for-byte the checklist shortcut
  // (useChecklistActions). A click fires this once; no destructive route param needed.
  const onCreateContract = () =>
    contractActions.createContract(() => setSearchParams({ sheet: 'contract' }));
  const createDepositInvoiceHref = buildCreateDepositHref(bookingId, booking, userProfile?.depositPercentage);
  const markSentInvoice = sheet === 'markSent' && sheetInvoiceId ? sheetInvoice : undefined;
  const seriesCompose = seriesComposeProps(composingSeriesInvoice, composeSeries);

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
      <VenueQuickTweakSheet
        bookingId={bookingId}
        venue={booking.venue}
        open={sheet === 'venueTweak'}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
      />
      <PeopleQuickTweakSheet
        bookingId={bookingId}
        customer={booking.customer}
        agent={booking.bookingAgent}
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
      <BandSheet
        bookingId={bookingId}
        lineups={booking.band.lineups}
        chairs={booking.band.chairs}
        members={booking.band.members}
        packages={booking.packages}
        venue={booking.venue}
        // Absent with the flag off (#884) even if ?sheet=band is reached by hand — the entry
        // point is already flag-gated, this is defence in depth.
        open={sheet === 'band' && isEnabled('VITE_FEATURE_BAND_MEMBERS')}
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
        // Held shut until an edit target has actually resolved: InvoiceSheet seeds its form
        // on the open transition only, so opening early would show a create-mode form and
        // never correct itself once the invoice arrived. Create mode (no invoiceId) is
        // unaffected and opens at once.
        open={sheet === 'invoice' && (!sheetInvoiceId || !!editingInvoice)}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
        // #847: owner-derived, like the row menu's Send. InvoiceSheet has been series-capable
        // since #845, so a series draft issued *from the sheet* chained straight into a
        // booking-mode compose — hidden template, nothing attached, and a send posting a series
        // invoice id to a booking route. The second entry point onto the same defect.
        onAfterIssue={(inv) => {
          setSearchParams({ sheet: 'compose', templateType: coverTemplateFor(inv) });
        }}
      />
      <ComposeEmailSheet
        bookingId={bookingId}
        booking={booking}
        invoices={invoices}
        checklist={checklist}
        defaultPaymentTermsDays={userProfile?.defaultPaymentTermsDays}
        series={seriesCompose.series}
        open={sheet === 'compose' && seriesCompose.ready}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
        initialTemplateType={sheet === 'compose' ? sheetTemplateType : undefined}
        onCreateContract={onCreateContract}
        creatingContract={contractActions.isCreatingContract}
        createDepositInvoiceHref={createDepositInvoiceHref}
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
