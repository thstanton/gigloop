import { useAuth } from '@clerk/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DocumentsCard } from '@/features/bookings/DocumentsCard';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useBookingCommunications } from '@/lib/hooks/useBookingCommunications';
import { useBookingDocuments } from '@/lib/hooks/useBookingDocuments';
import { useSeriesBookings } from '@/lib/hooks/useSeriesBookings';
import SeriesInvoiceCard from '@/features/bookings/SeriesInvoiceCard';
import { SeriesEventsCard } from '@/features/bookings/SeriesEventsCard';
import ContractCard from '@/features/bookings/ContractCard';
import InvoiceSection from '@/features/bookings/InvoiceSection';
import ChecklistSection from '@/features/bookings/ChecklistSection';
import PersonCard from '@/features/bookings/PersonCard';
import InlineNotes from '@/features/bookings/InlineNotes';
import CommunicationsSection from '@/features/bookings/CommunicationsSection';
import ItineraryCard from '@/features/bookings/ItineraryCard';
import DetailsCard from '@/features/bookings/DetailsCard';
import PerformanceSection from '@/features/bookings/PerformanceSection';
import MusicFormSection from '@/features/bookings/MusicFormSection';
import { InlineVenueAdd } from '@/features/bookings/InlineVenueAdd';
import { BookingVenueMapWidget } from '@/features/bookings/BookingVenueMapWidget';
import { SectionHeader } from '@/components/common/SectionHeader';
import { apiGet } from '@/lib/api';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type {
  Invoice,
  MusicFormConfig,
} from '@/types/api';

interface BookingDetailDesktopProps {
  bookingId: string;
}

export function BookingDetailDesktop({ bookingId }: BookingDetailDesktopProps) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { isLoaded } = useAuth();
  const { data: booking } = useBooking(bookingId);
  const { data: communications = [] } = useBookingCommunications(bookingId);
  const { data: documents = [] } = useBookingDocuments(bookingId);
  const { data: seriesBookings = [], isLoading: seriesBookingsLoading } = useSeriesBookings(booking?.series?.id);

  const { data: musicFormConfig, isLoading: musicFormConfigLoading } = useQuery({
    queryKey: ['booking-music-form-config', bookingId],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${bookingId}/music-form-config`),
    enabled: isLoaded && !!booking && booking.hasMusicFormConfig,
  });

  const contractActions = useContractActions(bookingId);
  const fields = useBookingFields(bookingId);
  const { checklist, checklistLoading, toggleItem, addItem, isAddingItem } = useBookingChecklist(bookingId, booking, isLoaded);

  if (!booking) return null;

  const title = booking.title ?? EVENT_TYPE_LABELS[booking.eventType];
  const backState = { from: `/admin/bookings/${bookingId}`, label: title };
  const hasDepositItem = checklist.some((item) => item.key === 'deposit_received');
  const contractShortcutType = hasDepositItem ? 'contract_and_deposit_cover' : 'contract_cover';

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
            />
            <DetailsCard
              logistics={booking.logistics}
            />
          </div>
          <BookingVenueMapWidget
            bookingId={bookingId}
            contactHref={`/admin/contacts/${booking.venue?.id ?? ''}`}
          />
          {!booking.venue && <InlineVenueAdd bookingId={booking.id} />}
        </section>

        {/* Packages */}
        <section>
          <SectionHeader label="Packages" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PerformanceSection
              booking={booking}
            />
            <MusicFormSection
              booking={booking}
              documents={documents}
              config={musicFormConfig ?? null}
              isLoading={musicFormConfigLoading}
              onUpdateConfig={() => editSection('musicForm')}
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
            bookingId={bookingId}
            items={checklist}
            isLoading={checklistLoading}
            bookingStatus={booking.status}
            onToggle={(itemId, state) => toggleItem(itemId, state)}
            onAddItem={(data) => addItem(data)}
            isAddingItem={isAddingItem}
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
            onCreateContract={() => {
              contractActions.createContract();
              setSearchParams({ sheet: 'contract' });
            }}
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
          <InvoiceSection bookingId={bookingId} />
        )}

        {/* Documents */}
        <DocumentsCard bookingId={bookingId} />

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
        />
      </div>

    </div>
  );
}
