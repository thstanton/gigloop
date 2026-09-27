import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Users } from 'lucide-react';
import { SectionHeader } from '@/components/common/SectionHeader';
import { GhostButton } from '@/components/common/GhostButton';
import BookingDetailTabs from '@/features/bookings/BookingDetailTabs';
import ItineraryCard from '@/features/bookings/ItineraryCard';
import DetailsCard from '@/features/bookings/DetailsCard';
import BandCard from '@/features/bookings/BandCard';
import { BookingVenueMapWidget } from '@/features/bookings/BookingVenueMapWidget';
import InlineNotes from '@/features/bookings/InlineNotes';
import PersonChip from '@/features/bookings/PersonChip';
import { SeriesEventsCard } from '@/features/bookings/SeriesEventsCard';
import ContractCard from '@/features/bookings/ContractCard';
import SeriesInvoiceCard from '@/features/bookings/SeriesInvoiceCard';
import InvoiceSection from '@/features/bookings/InvoiceSection';
import { DocumentsCard } from '@/features/bookings/DocumentsCard';
import MusicFormSection from '@/features/bookings/MusicFormSection';
import { AddToTheDayCard, type AddToTheDayConcern } from '@/features/bookings/AddToTheDayCard';
import CommunicationsSection from '@/features/bookings/CommunicationsSection';
import type {
  BookingBand,
  BookingDetail,
  BookingListItem,
  Communication,
  Contract,
  Document,
  Invoice,
  LineupTemplate,
  MusicFormConfig,
} from '@/types/api';

export interface MobileBookingContentData {
  booking: BookingDetail;
  bookingId: string;
  backState: Record<string, string>;
  bandData: BookingBand | null;
  documents: Document[];
  musicFormConfig: MusicFormConfig | null | undefined;
  musicFormConfigLoading: boolean;
  isTurningOnMusicForm: boolean;
  lineupTemplates: LineupTemplate[];
  seriesBookings: BookingListItem[];
  seriesBookingsLoading: boolean;
  invoices: Invoice[];
  contractShortcutType: 'contract_and_deposit_cover' | 'contract_cover';
  contractActions: {
    createContract: (onCreated?: (contract: Contract) => void) => void;
    isCreatingContract: boolean;
    voidContract: (args: { contractId: string; confirmSignedVoid: boolean }) => void;
    isVoidingContract: boolean;
    deleteContract: (contractId: string) => void;
    isDeletingContract: boolean;
  };
  fields: { updateNotes: (notes: string) => void; isNotesPending: boolean };
  missingConcerns: AddToTheDayConcern[];
  communications: Communication[];
}

export interface MobileBookingContentActions {
  navigate: ReturnType<typeof useNavigate>;
  setSearchParams: (params: Record<string, string>) => void;
  openCompose: (templateType?: string) => void;
  openEditInvoice: (invoice: Invoice) => void;
  onTurnOnMusicForm: () => void;
  onEditMusicForm: () => void;
}

interface MobileBookingContentProps {
  data: MobileBookingContentData;
  actions: MobileBookingContentActions;
  defaultTab: 'checklist' | 'onTheDay';
  checklist: ReactNode;
}

function MobileOnTheDay({ data, actions }: Readonly<Pick<MobileBookingContentProps, 'data' | 'actions'>>) {
  const { booking, bookingId, bandData, documents, musicFormConfig, musicFormConfigLoading, missingConcerns } = data;
  const { fields, onTurnOnMusicForm, onEditMusicForm, setSearchParams } = actions;

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ItineraryCard
          logistics={booking.logistics}
          sets={booking.sets}
          packages={booking.packages}
          hideWhenEmpty
          bandLineups={bandData?.lineups ?? []}
          bandChairs={bandData?.chairs ?? []}
          bandMembers={bandData?.members ?? []}
        />
        <DetailsCard logistics={booking.logistics} hideWhenEmpty bandMembersEnabled={bandData !== null} />
      </div>
      <BookingVenueMapWidget
        bookingId={bookingId}
        contactHref={`/admin/contacts/${booking.venue?.id ?? ''}`}
      />
      {bandData && (
        <div className="flex justify-end">
          <GhostButton
            variant="primary"
            size="xs"
            icon={<Users size={13} />}
            onClick={() => setSearchParams({ sheet: 'band' })}
          >
            {booking.band.chairs.length > 0 ? `Band (${booking.band.chairs.length})` : 'Add band'}
          </GhostButton>
        </div>
      )}
      <AddToTheDayCard concerns={missingConcerns} />
      <MusicFormSection
        booking={booking}
        documents={documents}
        config={musicFormConfig ?? null}
        isLoading={musicFormConfigLoading}
        onTurnOn={onTurnOnMusicForm}
        isTurningOn={data.isTurningOnMusicForm}
        onEdit={onEditMusicForm}
        hideWhenOff
      />
      <InlineNotes notes={booking.notes} onSave={(notes) => fields.updateNotes(notes)} isSaving={fields.isNotesPending} />
    </div>
  );
}

function MobilePeopleAndBand({ data, actions }: Readonly<Pick<MobileBookingContentProps, 'data' | 'actions'>>) {
  const { booking, backState, bandData, lineupTemplates } = data;
  const { setSearchParams } = actions;

  return (
    <>
      <section>
        <SectionHeader
          label="People"
          action={(
            <GhostButton variant="primary" size="xs" icon={<Pencil size={13} />} onClick={() => setSearchParams({ sheet: 'peopleTweak' })}>
              Edit
            </GhostButton>
          )}
        />
        <div className="flex flex-row gap-4">
          <PersonChip role="Customer" contact={booking.customer} linkState={backState} />
          {booking.bookingAgent && <PersonChip role="Booking agent" contact={booking.bookingAgent} linkState={backState} />}
        </div>
      </section>
      {bandData && <BandCard band={bandData} hasLineupTemplates={lineupTemplates.length > 0} linkState={backState} />}
    </>
  );
}

function MobileSeriesDetails({ data, actions }: Readonly<Pick<MobileBookingContentProps, 'data' | 'actions'>>) {
  const { booking, seriesBookings, seriesBookingsLoading } = data;
  const { navigate, setSearchParams } = actions;
  if (!booking.series) return null;

  return (
    <>
      <section>
        <SectionHeader label="Series" />
        <span className="inline-flex items-center text-sm text-foreground border border-border rounded-full px-3 py-1.5">
          {booking.series.label}
        </span>
      </section>
      <SeriesEventsCard
        bookings={seriesBookings.filter((item) => item.id !== booking.id)}
        isLoading={seriesBookingsLoading}
        onCopyEvent={() => setSearchParams({ sheet: 'copyEvent' })}
        onAddToSeries={() => navigate('/admin/bookings/new', {
          state: {
            seriesId: booking.series?.id,
            customerId: booking.customer.id,
            venueId: booking.venue?.id,
            bookingAgentId: booking.bookingAgent?.id,
          },
        })}
      />
    </>
  );
}

function MobileContractsAndDocuments({ data, actions }: Readonly<Pick<MobileBookingContentProps, 'data' | 'actions'>>) {
  const { booking, bookingId, documents, bandData, contractShortcutType, contractActions } = data;
  const { openCompose, openEditInvoice, setSearchParams } = actions;

  return (
    <>
      {booking.status !== 'CANCELLED' && (
        <ContractCard
          booking={booking}
          documents={documents}
          isCreating={contractActions.isCreatingContract}
          isVoidingContract={contractActions.isVoidingContract}
          isDeletingContract={contractActions.isDeletingContract}
          onCreateContract={() => contractActions.createContract(() => setSearchParams({ sheet: 'contract' }))}
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
          onSend={() => openCompose('series_invoice_cover')}
          onMarkSent={(invoice) => setSearchParams({ sheet: 'markSent', invoiceId: invoice.id })}
        />
      ) : (
        <InvoiceSection bookingId={bookingId} />
      )}
      <DocumentsCard bookingId={bookingId} />
      <CommunicationsSection
        communications={data.communications}
        bandMembers={bandData?.members ?? []}
        bandCommunicationsEnabled={bandData !== null}
      />
    </>
  );
}

function MobileBookingInfo({ data, actions }: Readonly<Pick<MobileBookingContentProps, 'data' | 'actions'>>) {
  return (
    <div className="space-y-6 pt-2">
      <MobilePeopleAndBand data={data} actions={actions} />
      <MobileSeriesDetails data={data} actions={actions} />
      <MobileContractsAndDocuments data={data} actions={actions} />
    </div>
  );
}

export function BookingDetailMobileContent({ data, actions, defaultTab, checklist }: MobileBookingContentProps) {
  return (
    <BookingDetailTabs
      defaultTab={defaultTab}
      checklist={checklist}
      onTheDay={<MobileOnTheDay data={data} actions={actions} />}
      info={<MobileBookingInfo data={data} actions={actions} />}
    />
  );
}
