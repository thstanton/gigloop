import { useAuth } from '@clerk/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ClipboardList, Info, MapPin } from 'lucide-react';
import { LOGISTICS_BAND_ONLY_KEYS, LOGISTICS_DETAIL_KEYS, LOGISTICS_SYSTEM_KEYS } from '@/lib/constants';
import { isEnabled } from '@/lib/featureFlags';

import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useBookingCommunications } from '@/lib/hooks/useBookingCommunications';
import { useBookingDocuments } from '@/lib/hooks/useBookingDocuments';
import { useSeriesBookings } from '@/lib/hooks/useSeriesBookings';
import { useConfigureMusicForm } from '@/lib/hooks/useConfigureMusicForm';
import { useLineupTemplates } from '@/lib/hooks/useLineupTemplates';
import {
  BookingDetailMobileContent,
  type MobileBookingContentActions,
  type MobileBookingContentData,
} from '@/features/bookings/BookingDetailMobileContent';
import ChecklistSection, { clientDisplayName } from '@/features/bookings/ChecklistSection';
import { contractCoverTemplateFor } from '@/lib/invoiceDerivations';
import { apiGet } from '@/lib/api';
import type {
  Invoice,
  BookingDetail,
  MusicFormConfig,
} from '@/types/api';
import type { AddToTheDayConcern } from '@/features/bookings/AddToTheDayCard';

// Module scope, not the component body — the old copy of this set was rebuilt on every render.
const LOGISTICS_SYSTEM_KEY_SET = new Set<string>(LOGISTICS_SYSTEM_KEYS);

function mobileDefaultTab(status: BookingDetail['status']): 'checklist' | 'onTheDay' {
  return ['ENQUIRY', 'PROVISIONAL', 'CONFIRMED'].includes(status) ? 'checklist' : 'onTheDay';
}

function itineraryIsEmpty(booking: BookingDetail): boolean {
  const logistics = booking.logistics;
  return !booking.sets.length && !logistics?.arrivalTime?.value &&
    !logistics?.soundCheckTime?.value && !logistics?.finishTime?.value;
}

function detailsAreEmpty(
  logistics: BookingDetail['logistics'],
  bandMembersEnabled: boolean,
): boolean {
  const visibleKeys = bandMembersEnabled
    ? LOGISTICS_DETAIL_KEYS
    : LOGISTICS_DETAIL_KEYS.filter((key) => !LOGISTICS_BAND_ONLY_KEYS.includes(key));
  const hasVisibleSystemDetail = visibleKeys.some((key) => Boolean(logistics?.[key]?.value));
  const hasCustomDetail = Object.entries(logistics ?? {}).some(
    ([key, entry]) => !LOGISTICS_SYSTEM_KEY_SET.has(key) && Boolean(entry.value),
  );
  return !hasVisibleSystemDetail && !hasCustomDetail;
}

function missingConcern(
  missing: boolean,
  concern: AddToTheDayConcern,
): AddToTheDayConcern | null {
  return missing ? concern : null;
}

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
  const bandMembersEnabled = isEnabled('VITE_FEATURE_BAND_MEMBERS');
  // The Band card's "has a multi-person lineup" signal (ADR-0073 §6) — deliberately kept off the
  // booking response, so it's derived here from the same query the Band sheet already uses.
  const { data: lineupTemplates = [] } = useLineupTemplates(bandMembersEnabled);

  if (isLoading) return <MobileTabsSkeleton />;
  if (!booking) return null;

  const bandData = bandMembersEnabled ? booking.band : null;
  const title = booking.title || `Booking ${bookingId.slice(0, 8)}`;
  const backState = { from: `/admin/bookings/${bookingId}`, label: title };
  // #756: key off the deposit invoice, not a checklist item — see BookingDetailDesktop for the full
  // rationale (goals-only checklist made the old `deposit_received` check permanently false).
  const contractShortcutType = contractCoverTemplateFor(invoices);

  const defaultTab = mobileDefaultTab(booking.status);
  const itineraryEmpty = itineraryIsEmpty(booking);
  // The two shareWithBand fields are not a complete concern when the flag is off (#888).
  const detailsEmpty = detailsAreEmpty(booking.logistics, bandMembersEnabled);
  const venueEmpty = !booking.venue;
  const musicOff = !booking.hasMusicFormConfig;

  const missingConcerns = [
    missingConcern(itineraryEmpty, { icon: <Clock size={16} />, label: 'Itinerary', actionLabel: 'Add', onAction: () => setSearchParams({ sheet: 'itineraryTweak' }) }),
    missingConcern(detailsEmpty, { icon: <Info size={16} />, label: 'Details', actionLabel: 'Add', onAction: () => setSearchParams({ sheet: 'detailsTweak' }) }),
    missingConcern(venueEmpty, { icon: <MapPin size={16} />, label: 'Venue', actionLabel: 'Add', onAction: () => setSearchParams({ sheet: 'venueTweak' }) }),
    missingConcern(musicOff, { icon: <ClipboardList size={16} />, label: 'Music form', actionLabel: 'Set up', onAction: () => turnOnMusicForm.mutate() }),
  ].filter((concern): concern is AddToTheDayConcern => concern !== null);

  function openCompose(templateType?: string) {
    setSearchParams(templateType ? { sheet: 'compose', templateType } : { sheet: 'compose' });
  }

  function openEditInvoice(invoice: Invoice) {
    setSearchParams({ sheet: 'invoice', invoiceId: invoice.id });
  }

  const content: MobileBookingContentData = {
    booking,
    bookingId,
    backState,
    bandData,
    documents,
    musicFormConfig,
    musicFormConfigLoading,
    isTurningOnMusicForm: turnOnMusicForm.isPending,
    lineupTemplates,
    seriesBookings,
    seriesBookingsLoading,
    invoices,
    contractShortcutType,
    contractActions,
    fields,
    missingConcerns,
    communications,
  };
  const actions: MobileBookingContentActions = {
    navigate,
    setSearchParams,
    openCompose,
    openEditInvoice,
    onTurnOnMusicForm: () => turnOnMusicForm.mutate(),
    onEditMusicForm: () => setSearchParams({ sheet: 'musicTweak' }),
  };

  return (
    <BookingDetailMobileContent
      defaultTab={defaultTab}
      data={content}
      actions={actions}
      checklist={
        booking.status === 'CANCELLED' ? null : (
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
        )
      }
    />
  );
}
