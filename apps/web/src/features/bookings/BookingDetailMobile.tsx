import { useAuth } from '@clerk/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useBookingCommunications } from '@/lib/hooks/useBookingCommunications';
import { useBookingDocuments } from '@/lib/hooks/useBookingDocuments';
import { useSeriesBookings } from '@/lib/hooks/useSeriesBookings';
import { useConfigureMusicForm } from '@/lib/hooks/useConfigureMusicForm';
import BookingDetailTabs from '@/features/bookings/BookingDetailTabs';
import ChecklistSection from '@/features/bookings/ChecklistSection';
import ItineraryCard from '@/features/bookings/ItineraryCard';
import DetailsCard from '@/features/bookings/DetailsCard';
import { BookingVenueMapWidget } from '@/features/bookings/BookingVenueMapWidget';
import InlineNotes from '@/features/bookings/InlineNotes';
import PersonChip from '@/features/bookings/PersonChip';
import { SeriesEventsCard } from '@/features/bookings/SeriesEventsCard';
import ContractCard from '@/features/bookings/ContractCard';
import SeriesInvoiceCard from '@/features/bookings/SeriesInvoiceCard';
import InvoiceSection from '@/features/bookings/InvoiceSection';
import { DocumentsCard } from '@/features/bookings/DocumentsCard';
import PerformanceSection from '@/features/bookings/PerformanceSection';
import MusicFormSection from '@/features/bookings/MusicFormSection';
import CommunicationsSection from '@/features/bookings/CommunicationsSection';
import { SectionHeader } from '@/components/common/SectionHeader';
import { apiGet } from '@/lib/api';
import type {
  Invoice,
  MusicFormConfig,
} from '@/types/api';

interface BookingDetailMobileProps {
  bookingId: string;
}

export function MobileTabsSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border">
        <div className="flex-1 h-12 bg-border" />
        <div className="flex-1 h-12 bg-border" />
        <div className="flex-1 h-12 bg-border" />
      </div>
      {/* Content area */}
      <div className="space-y-4 pt-4">
        <div className="h-8 w-full bg-border rounded" />
        <div className="space-y-3">
          <div className="h-24 w-full bg-border rounded" />
          <div className="h-24 w-full bg-border rounded" />
        </div>
      </div>
    </div>
  );
}

export function BookingDetailMobile({ bookingId }: BookingDetailMobileProps) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { isLoaded } = useAuth();
  const { data: booking, isLoading } = useBooking(bookingId);
  const { data: communications = [] } = useBookingCommunications(bookingId);
  const { data: documents = [] } = useBookingDocuments(bookingId);
  const { data: seriesBookings = [], isLoading: seriesBookingsLoading } = useSeriesBookings(booking?.series?.id);

  const { data: musicFormConfig, isLoading: musicFormConfigLoading } = useQuery({
    queryKey: ['booking-music-form-config', bookingId],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${bookingId}/music-form-config`),
    enabled: isLoaded && !!booking && booking.hasMusicFormConfig,
  });

  const turnOnMusicForm = useConfigureMusicForm(bookingId, booking, () => editSection('musicForm'));
  const contractActions = useContractActions(bookingId);
  const fields = useBookingFields(bookingId);
  const {
    checklist,
    checklistLoading,
    toggleItem,
    addItem,
    isAddingItem,
  } = useBookingChecklist(bookingId, booking, isLoaded);

  if (isLoading) return <MobileTabsSkeleton />;
  if (!booking) return null;

  const title = booking.title || `Booking ${bookingId.slice(0, 8)}`;
  const backState = { from: `/admin/bookings/${bookingId}`, label: title };
  const hasDepositItem = checklist.some((item) => item.key === 'deposit_received');
  const contractShortcutType = hasDepositItem ? 'contract_and_deposit_cover' : 'contract_cover';

  const defaultTab: 'checklist' | 'onTheDay' =
    booking.status === 'ENQUIRY' || booking.status === 'PROVISIONAL' || booking.status === 'CONFIRMED'
      ? 'checklist'
      : 'onTheDay';

  function openCompose(templateType?: string) {
    setSearchParams(templateType ? { sheet: 'compose', templateType } : { sheet: 'compose' });
  }

  function openEditInvoice(invoice: Invoice) {
    setSearchParams({ sheet: 'invoice', invoiceId: invoice.id });
  }

  function editSection(section: string) {
    setSearchParams({ sheet: 'bookingEdit', section });
  }

  return (
    <BookingDetailTabs
      defaultTab={defaultTab}
      checklist={
        booking.status !== 'CANCELLED' ? (
          <ChecklistSection
            bookingId={bookingId}
            items={checklist}
            isLoading={checklistLoading}
            bookingStatus={booking.status}
            onToggle={(itemId, state) => toggleItem(itemId, state)}
            onAddItem={(data) => addItem(data)}
            isAddingItem={isAddingItem}
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
              packages={booking.packages}
              hideWhenEmpty
            />
            <DetailsCard
              logistics={booking.logistics}
              hideWhenEmpty
            />
          </div>
          <BookingVenueMapWidget
            bookingId={bookingId}
            contactHref={`/admin/contacts/${booking.venue?.id ?? ''}`}
          />
          <MusicFormSection
            booking={booking}
            documents={documents}
            config={musicFormConfig ?? null}
            isLoading={musicFormConfigLoading}
            onTurnOn={() => turnOnMusicForm.mutate()}
            isTurningOn={turnOnMusicForm.isPending}
            onEdit={() => editSection('musicForm')}
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
              onCopyEvent={() => setSearchParams({ sheet: 'copyEvent' })}
              onAddToSeries={() => navigate('/admin/bookings/new', { state: { seriesId: booking.series!.id } })}
            />
          )}

          {booking.status !== 'CANCELLED' && (
            <ContractCard
              booking={booking}
              documents={documents}
              isCreating={contractActions.isCreatingContract}
              isVoidingContract={contractActions.isVoidingContract}
              isDeletingContract={contractActions.isDeletingContract}
              onCreateContract={() => contractActions.createContract(() => {
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
            <InvoiceSection bookingId={bookingId} />
          )}

          <DocumentsCard bookingId={bookingId} />

          <PerformanceSection
            booking={booking}
            hideWhenEmpty
          />

          <CommunicationsSection
            communications={communications}
          />
        </div>
      }
    />
  );
}

