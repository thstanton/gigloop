import { useAuth } from '@clerk/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, FileText, Download } from 'lucide-react';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingActions } from '@/lib/hooks/useBookingActions';
import { useBookingChecklist } from '@/lib/hooks/useBookingChecklist';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import { useContractActions } from '@/lib/hooks/useContractActions';
import { useInvoiceActions } from '@/lib/hooks/useInvoiceActions';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
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
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { apiGet } from '@/lib/api';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type {
  Contract,
  Document,
  Invoice,
  MusicFormConfig,
  UserProfile,
} from '@/types/api';

interface BookingDetailDesktopProps {
  bookingId: string;
  onCreateContract: (contract: Contract) => void;
}

export function BookingDetailDesktop({ bookingId, onCreateContract }: BookingDetailDesktopProps) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { isLoaded } = useAuth();
  const { data: booking } = useBooking(bookingId);
  const { data: invoices = [], isPending: invoicesPending } = useBookingInvoices(bookingId);
  const { data: communications = [] } = useBookingCommunications(bookingId);
  const { data: documents = [] } = useBookingDocuments(bookingId);
  const { data: seriesBookings = [], isLoading: seriesBookingsLoading } = useSeriesBookings(booking?.series?.id);

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const { data: musicFormConfig, isLoading: musicFormConfigLoading } = useQuery({
    queryKey: ['booking-music-form-config', bookingId],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${bookingId}/music-form-config`),
    enabled: isLoaded && !!booking && booking.hasMusicFormConfig,
  });

  const actions = useBookingActions(bookingId);
  const contractActions = useContractActions(bookingId);
  const invoiceActions = useInvoiceActions(bookingId);
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

  function buildSetsDescription(): string {
    if (!booking!.sets?.length) return '';
    const formatById = new Map(
      (booking!.packages ?? []).map((f) => [f.packageId, f.package.label]),
    );
    return booking!.sets
      .map((s) => {
        const label = s.label ?? (s.packageId ? formatById.get(s.packageId) : null) ?? null;
        return label ? `${label} (${s.duration} min)` : `${s.duration} min`;
      })
      .join(', ');
  }

  function openCreateInvoice(prefill?: { isDeposit: boolean; amount?: number }) {
    const params: Record<string, string> = { sheet: 'invoice', isDeposit: String(prefill?.isDeposit ?? false) };
    if (prefill?.amount != null) params.amount = String(prefill.amount);
    const desc = buildSetsDescription();
    if (desc) params.description = desc;
    setSearchParams(params);
  }

  function openEditInvoice(invoice: Invoice) {
    setSearchParams({ sheet: 'invoice', invoiceId: invoice.id });
  }

  function openSendInvoice(invoice: Invoice) {
    const templateType = invoice.isDeposit ? 'deposit_invoice_cover' : 'balance_invoice_cover';
    openCompose(templateType);
  }

  function handleChecklistAction(action: 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract') {
    if (action === 'create_contract') {
      contractActions.createContract((contract) => {
        onCreateContract(contract);
        setSearchParams({ sheet: 'contract' });
      });
      return;
    }
    const isDeposit = action === 'create_deposit_invoice';
    const fee = booking!.fee ? parseFloat(booking!.fee) : null;
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
      if (booking!.activeContract) actions.markContractSigned(booking!.activeContract.id);
    } else {
      const sentDeposit = invoices.find((inv) => inv.isDeposit && inv.status === 'SENT');
      if (sentDeposit) invoiceActions.markPaid(sentDeposit.id);
      else actions.markDepositReceived();
    }
  }

  function editSection(section: string) {
    setSearchParams({ sheet: 'bookingEdit', section });
  }

  async function downloadDoc(url: string, filename: string) {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = window.document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
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
              onEdit={() => editSection('onTheDay')}
            />
            <DetailsCard
              logistics={booking.logistics}
              onEdit={() => editSection('onTheDay')}
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
              onEdit={() => editSection('packages')}
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
            items={checklist}
            isLoading={checklistLoading}
            bookingStatus={booking.status}
            onToggle={(itemId, state) => toggleItem(itemId, state)}
            onChecklistAction={handleChecklistAction}
            onOpenCompose={openCompose}
            onMarkDone={handleMarkDone}
            onAddItem={(data) => addItem(data)}
            isAddingItem={isAddingItem}
            isActionPending={actions.isPending || invoiceActions.isMarkingPaid}
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
            onCreateContract={() => contractActions.createContract((contract) => {
              onCreateContract(contract);
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
          <InvoiceSection
            invoices={invoices}
            documents={documents}
            isPending={invoicesPending}
            onNewDepositInvoice={() => {
              const fee = booking.fee ? parseFloat(booking.fee) : null;
              const pct = userProfile?.depositPercentage;
              openCreateInvoice({
                isDeposit: true,
                amount: fee && pct ? Math.round((fee * pct / 100) * 100) / 100 : undefined,
              });
            }}
            onNewBalanceInvoice={() => {
              const fee = booking.fee ? parseFloat(booking.fee) : null;
              const pct = userProfile?.depositPercentage;
              openCreateInvoice({
                isDeposit: false,
                amount: fee && pct ? Math.round((fee * (1 - pct / 100)) * 100) / 100 : undefined,
              });
            }}
            onEdit={openEditInvoice}
            onDelete={(inv) => actions.deleteInvoice(inv.id)}
            onSend={openSendInvoice}
            onMarkSent={(inv) => setSearchParams({ sheet: 'markSent', invoiceId: inv.id })}
            onMarkPaid={(inv) => invoiceActions.markPaid(inv.id)}
            onVoid={(inv) => invoiceActions.voidInvoice(inv.id)}
          />
        )}

        {/* Documents */}
        <Card title="Documents">
          {documents.length === 0 ? (
            <div className="flex items-center gap-2 text-muted py-1">
              <FolderOpen size={14} />
              <span className="text-sm">No documents yet</span>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {documents.map((doc: Document) => {
                const invoice = invoices.find((i) => i.id === doc.invoiceId);
                const isVoidContract = doc.type === 'CONTRACT' && doc.contractStatus === 'VOID';
                const contractLabel = isVoidContract ? 'Contract [VOID]' : 'Contract';
                const invoiceLabel = invoice?.isDeposit ? 'Deposit invoice' : 'Balance invoice';
                const label = doc.type === 'CONTRACT' ? contractLabel : invoiceLabel;
                const filename = `${label.toLowerCase().replace(' ', '-')}.pdf`;
                return (
                  <div key={doc.id} className="flex items-center gap-2 py-2">
                    <FileText size={14} className="flex-shrink-0 text-muted mt-0.5 self-start" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-foreground">{label}</span>
                      {invoice?.invoiceNumber && (
                        <span className="text-xs text-muted">{invoice.invoiceNumber}</span>
                      )}
                    </div>
                    <span className="text-muted ml-auto text-xs shrink-0">
                      {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => downloadDoc(doc.url, filename)}
                      title="Download"
                      className="text-muted hover:text-foreground shrink-0"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

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
          onCompose={() => openCompose()}
        />
      </div>

    </div>
  );
}
