import { useAuth } from '@clerk/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ClipboardList, Info, MapPin, Pencil } from 'lucide-react';
import { LOGISTICS_DETAIL_KEYS, LOGISTICS_SYSTEM_KEYS } from '@/lib/constants';

import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useBookingCommunications } from '@/lib/hooks/useBookingCommunications';
import { useBookingDocuments } from '@/lib/hooks/useBookingDocuments';
import { useSeriesBookings } from '@/lib/hooks/useSeriesBookings';
import { useConfigureMusicForm } from '@/lib/hooks/useConfigureMusicForm';
import BookingDetailTabs from '@/features/bookings/BookingDetailTabs';
import ChecklistSection, { clientDisplayName } from '@/features/bookings/ChecklistSection';
import ItineraryCard from '@/features/bookings/ItineraryCard';
import DetailsCard from '@/features/bookings/DetailsCard';
import { BookingVenueMapWidget } from '@/features/bookings/BookingVenueMapWidget';
import InlineNotes from '@/features/bookings/InlineNotes';
import PersonChip from '@/features/bookings/PersonChip';
import { SeriesEventsCard } from '@/features/bookings/SeriesEventsCard';
import ContractCard from '@/features/bookings/ContractCard';
import SeriesInvoiceCard from '@/features/bookings/SeriesInvoiceCard';
import InvoiceSection from '@/features/bookings/InvoiceSection';
import { contractCoverTemplateFor } from '@/lib/invoiceDerivations';
import { DocumentsCard } from '@/features/bookings/DocumentsCard';
import MusicFormSection from '@/features/bookings/MusicFormSection';
import { AddToTheDayCard, type AddToTheDayConcern } from '@/features/bookings/AddToTheDayCard';
import CommunicationsSection from '@/features/bookings/CommunicationsSection';
import { SectionHeader } from '@/components/common/SectionHeader';
import { GhostButton } from '@/components/common/GhostButton';
import { apiGet } from '@/lib/api';
import type {
  Invoice,
  MusicFormConfig,
} from '@/types/api';

// Module scope, not the component body — the old copy of this set was rebuilt on every render.
const LOGISTICS_SYSTEM_KEY_SET = new Set<string>(LOGISTICS_SYSTEM_KEYS);

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

  const turnOnMusicForm = useConfigureMusicForm(bookingId, booking, () => setSearchParams({ sheet: 'musicTweak' }));
  const contractActions = useContractActions(bookingId);
  const fields = useBookingFields(bookingId);
  const {
    checklist,
    checklistLoading,
    toggleItem,
    addItem,
    isAddingItem,
  } = useBookingChecklist(bookingId, booking, isLoaded);
  const { data: invoices = [] } = useBookingInvoices(bookingId);

  if (isLoading) return <MobileTabsSkeleton />;
  if (!booking) return null;

  const title = booking.title || `Booking ${bookingId.slice(0, 8)}`;
  const backState = { from: `/admin/bookings/${bookingId}`, label: title };
  // #756: key off the deposit invoice, not a checklist item — see BookingDetailDesktop for the full
  // rationale (goals-only checklist made the old `deposit_received` check permanently false).
  const contractShortcutType = contractCoverTemplateFor(invoices);

  const defaultTab: 'checklist' | 'onTheDay' =
    booking.status === 'ENQUIRY' || booking.status === 'PROVISIONAL' || booking.status === 'CONFIRMED'
      ? 'checklist'
      : 'onTheDay';

  // Derive which PM-hat concerns are missing so AddToTheDayCard can list them.
  const logistics = booking.logistics;
  const itineraryEmpty =
    !booking.sets.length &&
    !logistics?.arrivalTime?.value &&
    !logistics?.soundCheckTime?.value &&
    !logistics?.finishTime?.value;
  const detailsEmpty =
    !LOGISTICS_DETAIL_KEYS.some((k) => !!(logistics ?? {})[k]?.value) &&
    !Object.entries(logistics ?? {}).some(([k, e]) => !LOGISTICS_SYSTEM_KEY_SET.has(k) && !!e.value);
  const venueEmpty = !booking.venue;
  const musicOff = !booking.hasMusicFormConfig;

  const missingConcerns = [
    itineraryEmpty && { icon: <Clock size={16} />, label: 'Itinerary', actionLabel: 'Add', onAction: () => setSearchParams({ sheet: 'itineraryTweak' }) },
    detailsEmpty && { icon: <Info size={16} />, label: 'Details', actionLabel: 'Add', onAction: () => setSearchParams({ sheet: 'detailsTweak' }) },
    venueEmpty && { icon: <MapPin size={16} />, label: 'Venue', actionLabel: 'Add', onAction: () => setSearchParams({ sheet: 'venueTweak' }) },
    musicOff && { icon: <ClipboardList size={16} />, label: 'Music form', actionLabel: 'Set up', onAction: () => turnOnMusicForm.mutate() },
  ].filter(Boolean) as AddToTheDayConcern[];

  function openCompose(templateType?: string) {
    setSearchParams(templateType ? { sheet: 'compose', templateType } : { sheet: 'compose' });
  }

  function openEditInvoice(invoice: Invoice) {
    setSearchParams({ sheet: 'invoice', invoiceId: invoice.id });
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
            clientName={clientDisplayName(booking.customer)}
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
          <AddToTheDayCard concerns={missingConcerns} />
          <MusicFormSection
            booking={booking}
            documents={documents}
            config={musicFormConfig ?? null}
            isLoading={musicFormConfigLoading}
            onTurnOn={() => turnOnMusicForm.mutate()}
            isTurningOn={turnOnMusicForm.isPending}
            onEdit={() => setSearchParams({ sheet: 'musicTweak' })}
            hideWhenOff
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
            <SectionHeader
              label="People"
              action={
                <GhostButton
                  variant="primary"
                  size="xs"
                  icon={<Pencil size={13} />}
                  onClick={() => setSearchParams({ sheet: 'peopleTweak' })}
                >
                  Edit
                </GhostButton>
              }
            />
            <div className="flex flex-row gap-4">
              <PersonChip role="Customer" contact={booking.customer} linkState={backState} />
              {booking.bookingAgent && (
                <PersonChip
                  role="Booking agent"
                  contact={booking.bookingAgent}
                  linkState={backState}
                />
              )}
            </div>
          </section>

          {booking.series && (
            <section>
              <SectionHeader label="Series" />
              <span className="inline-flex items-center text-sm text-foreground border border-border rounded-full px-3 py-1.5">
                {booking.series.label}
              </span>
            </section>
          )}

          {booking.series && (
            <SeriesEventsCard
              bookings={seriesBookings.filter((b) => b.id !== booking.id)}
              isLoading={seriesBookingsLoading}
              onCopyEvent={() => setSearchParams({ sheet: 'copyEvent' })}
              onAddToSeries={() =>
                navigate('/admin/bookings/new', {
                  state: {
                    seriesId: booking.series!.id,
                    customerId: booking.customer.id,
                    venueId: booking.venue?.id,
                    bookingAgentId: booking.bookingAgent?.id,
                  },
                })
              }
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
              onEdit={openEditInvoice}
              onSend={() => openCompose('balance_invoice_cover')}
              onMarkSent={(inv) => setSearchParams({ sheet: 'markSent', invoiceId: inv.id })}
            />
          ) : (
            <InvoiceSection bookingId={bookingId} />
          )}

          <DocumentsCard bookingId={bookingId} />

          <CommunicationsSection
            communications={communications}
          />
        </div>
      }
    />
  );
}

