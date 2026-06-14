import { useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFocusReturn } from '@/lib/hooks/useFocusReturn';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import BookingEditDrawer from '@/features/bookings/BookingEditDrawer';
import ContractSheet from '@/features/bookings/ContractSheet';
import ContactEditSheet from '@/features/contacts/ContactEditSheet';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import { apiGet } from '@/lib/api';
import type {
  BookingSeries,
  BookingStatus,
  Template,
  UpdateBookingSeriesResponse,
  UserProfile,
} from '@/types/api';

const STATUS_LABELS: Record<BookingStatus, string> = {
  ENQUIRY:      'Enquiry',
  PROVISIONAL:  'Provisional',
  CONFIRMED:    'Confirmed',
  READY:        'Ready',
  COMPLETE:     'Complete',
  CANCELLED:    'Cancelled',
};

function isSeriesConfirmationRequired(r: object): r is Required<UpdateBookingSeriesResponse> {
  return 'requiresConfirmation' in r;
}

interface BookingDetailSheetsProps {
  bookingId: string;
}

export function BookingDetailSheets({ bookingId }: BookingDetailSheetsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);

  const sheet = searchParams.get('sheet');

  const { capture, restore } = useFocusReturn();
  const previousSheet = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (sheet && sheet !== 'bookingEdit' && !previousSheet.current) {
      capture();
    }
    previousSheet.current = sheet;
  }, [sheet, capture]);

  const sheetInvoiceId = searchParams.get('invoiceId');
  const sheetContactId = searchParams.get('contactId');
  const sheetTemplateType = searchParams.get('templateType') ?? undefined;
  const sheetIsDeposit = searchParams.get('isDeposit') === 'true';
  const sheetAmount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;
  const sheetDescription = searchParams.get('description') ?? undefined;
  const sheetSeriesId = searchParams.get('seriesId') ?? null;
  const sheetWarning = searchParams.get('warning') ?? '';
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

  const previousReadyDialog = useRef(false);
  useLayoutEffect(() => {
    if (readyDialogStatus && !previousReadyDialog.current) {
      capture();
    }
    previousReadyDialog.current = !!readyDialogStatus;
  }, [readyDialogStatus, capture]);

  const { data: invoices = [] } = useBookingInvoices(bookingId);
  const contractActions = useContractActions(bookingId);
  const fields = useBookingFields(bookingId);

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const { data: seriesList } = useQuery({
    queryKey: ['series'],
    queryFn: () => apiGet<BookingSeries[]>('/series'),
    enabled: isLoaded && sheet === 'series',
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
  const markSentInvoice = sheet === 'markSent' && sheetInvoiceId
    ? invoices.find((inv) => inv.id === sheetInvoiceId)
    : undefined;
  const editingContact = sheet === 'contactEdit' && sheetContactId
    ? ([booking.customer, booking.bookingAgent, booking.venue].find((c) => c?.id === sheetContactId) ?? null)
    : null;

  return (
    <>
      {readyDialogStatus && (
        <Sheet open onOpenChange={() => { dismissReadyDialog(); restore(); }}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle className="font-display text-xl">{celebratoryTitle}</SheetTitle>
            </SheetHeader>
            <SheetDescription className="mt-2">
              You've completed all the tasks for this booking. Ready to move it to{' '}
              <span className="font-medium text-foreground">{STATUS_LABELS[readyDialogStatus]}</span>?
            </SheetDescription>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => { dismissReadyDialog(); restore(); }} disabled={isConfirmingTransition}>
                Not yet
              </Button>
              <Button onClick={() => confirmStatusTransition(readyDialogStatus)} disabled={isConfirmingTransition}>
                {isConfirmingTransition ? 'Saving…' : `Mark as ${STATUS_LABELS[readyDialogStatus]}`}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      <ContractSheet
        bookingId={bookingId}
        readOnly={sheetContractReadOnly}
        open={sheet === 'contract'}
        onClose={() => { setSearchParams({}); restore(); }}
      />
      <BookingEditDrawer booking={booking} />
      <ContactEditSheet
        contact={editingContact}
        onClose={() => { setSearchParams({}); restore(); }}
        onUnlink={editingContact?.id === booking.venue?.id ? () => { fields.updateVenue(null); setSearchParams({}); restore(); } : undefined}
      />
      <InvoiceSheet
        bookingId={bookingId}
        invoice={editingInvoice}
        hasDepositInvoice={invoices.some((inv) => inv.isDeposit)}
        prefill={invoiceSheetPrefill}
        open={sheet === 'invoice'}
        onOpenChange={(open) => { if (!open) { setSearchParams({}); restore(); } }}
      />
      <ComposeEmailSheet
        bookingId={bookingId}
        booking={booking}
        invoices={invoices}
        defaultPaymentTermsDays={userProfile?.defaultPaymentTermsDays}
        open={sheet === 'compose'}
        onOpenChange={(open) => { if (!open) { setSearchParams({}); restore(); } }}
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
          onOpenChange={(open) => { if (!open) { setSearchParams({}); restore(); } }}
        />
      )}

      <Sheet open={sheet === 'series'} onOpenChange={(open) => { if (!open) { setSearchParams({}); setSelectedSeriesId(null); restore(); } }}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Add to series</SheetTitle>
          </SheetHeader>
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
                        restore();
                      },
                    });
                  }
                }}
                disabled={!selectedSeriesId || fields.isSeriesPending}
              >
                {fields.isSeriesPending ? 'Saving…' : 'Add to series'}
              </Button>
              <Button variant="outline" onClick={() => { setSearchParams({}); setSelectedSeriesId(null); restore(); }}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === 'customerMismatch'} onOpenChange={(open) => { if (!open) setSearchParams({ sheet: 'series' }); }}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Customer mismatch</SheetTitle>
          </SheetHeader>
          <SheetDescription className="pt-2">{sheetWarning}</SheetDescription>
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => {
                if (sheetSeriesId) {
                  fields.updateSeries({ seriesId: sheetSeriesId, confirm: true }, {
                    onSuccess: () => {
                      setSearchParams({});
                      setSelectedSeriesId(null);
                      restore();
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
        </SheetContent>
      </Sheet>
    </>
  );
}
