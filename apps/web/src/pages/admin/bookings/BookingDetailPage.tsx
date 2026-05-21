import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Music, FileText, DollarSign, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BookingStatusPill from '@/components/BookingStatusPill';
import InvoiceStatusPill from '@/components/InvoiceStatusPill';
import { useBooking } from '@/features/bookings/useBooking';
import { useBookingInvoices } from '@/features/bookings/useBookingInvoices';
import { useBookingCommunications } from '@/features/bookings/useBookingCommunications';
import type {
  BookingDetail,
  BookingStatus,
  Contact,
  PerformanceSet,
  Invoice,
  EventType,
  Communication,
} from '@/types/api';

// ─── Formatters ───────────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WEDDING:   'Wedding',
  CORPORATE: 'Corporate',
  PRIVATE:   'Private event',
  RESIDENCY: 'Residency',
  OTHER:     'Other',
};

const STATUS_ORDER: BookingStatus[] = [
  'ENQUIRY',
  'CONFIRMED',
  'INVOICED',
  'SETTLED',
  'COMPLETED',
  'CANCELLED',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFee(fee: string | null): string | null {
  if (!fee) return null;
  const n = parseFloat(fee);
  return isNaN(n) ? null : currencyFormatter.format(n);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

function invoiceLineTotal(invoice: Invoice): number {
  return invoice.lineItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
}

function statusGte(current: BookingStatus, threshold: BookingStatus): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}

// ─── Checklist ────────────────────────────────────────────────────────────────

type ChecklistState = 'done' | 'outstanding';

interface ChecklistItem {
  key: string;
  label: string;
  state: ChecklistState;
}

function buildChecklist(
  booking: BookingDetail,
  communications: Communication[],
): ChecklistItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDate = new Date(booking.date);
  bookingDate.setHours(0, 0, 0, 0);
  const bookingDatePassed = bookingDate < today;

  const trackDeposit = booking.depositTrackingMode !== 'NONE';

  const hasTemplate = (type: string) =>
    communications.some((c) => c.template?.builtInType === type);

  type RawItem = { key: string; label: string; done: boolean; irrelevant: boolean };

  const raw: RawItem[] = [
    {
      key: 'send_quote',
      label: 'Send quote',
      done: hasTemplate('quote'),
      irrelevant: statusGte(booking.status, 'CONFIRMED'),
    },
    {
      key: 'send_contract',
      label: 'Send contract & deposit email',
      done: hasTemplate('contract_cover') || hasTemplate('contract_and_invoice_cover'),
      irrelevant:
        !!booking.contractSignedAt &&
        (!!booking.depositReceivedAt || !trackDeposit),
    },
    {
      key: 'contract_signed',
      label: 'Contract signed',
      done: !!booking.contractSignedAt,
      irrelevant: booking.status === 'ENQUIRY' || statusGte(booking.status, 'SETTLED'),
    },
    {
      key: 'deposit_received',
      label: 'Deposit received',
      done: !!booking.depositReceivedAt,
      irrelevant: !trackDeposit || booking.status === 'ENQUIRY',
    },
    {
      key: 'music_form_invite',
      label: 'Send music form invite',
      done: hasTemplate('music_form_invite'),
      irrelevant: !booking.hasMusicFormConfig || booking.status === 'ENQUIRY',
    },
    {
      key: 'song_requests',
      label: 'Song requests received',
      done: booking.hasMusicFormResponse,
      irrelevant: !booking.hasMusicFormConfig || !hasTemplate('music_form_invite'),
    },
    {
      key: 'send_thank_you',
      label: 'Send thank you',
      done: hasTemplate('thank_you'),
      irrelevant: !bookingDatePassed,
    },
  ];

  return raw
    .filter((item) => !item.irrelevant)
    .map(({ key, label, done }) => ({ key, label, state: done ? 'done' : 'outstanding' as ChecklistState }));
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-sm font-semibold text-foreground mb-3">{label}</h2>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-background border border-border rounded-lg p-4">
      {title && (
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{title}</p>
      )}
      {children}
    </div>
  );
}

// ─── PersonCard ───────────────────────────────────────────────────────────────

function PersonCard({
  role,
  contact,
  commissionArrangement,
  linkState,
}: {
  role: string;
  contact: Contact;
  commissionArrangement?: string | null;
  linkState?: Record<string, string>;
}) {
  const contactLine = [contact.email, contact.phone].filter(Boolean).join(' · ');
  return (
    <Link
      to={`/admin/contacts/${contact.id}`}
      state={linkState}
      className="block py-4 border-b border-border last:border-0 group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5">{role}</p>
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {contact.name}
          </p>
          {contactLine && <p className="text-sm text-muted mt-0.5">{contactLine}</p>}
          {commissionArrangement && (
            <p className="text-sm text-muted mt-0.5">
              <span className="text-foreground">Commission</span>
              {' · '}{commissionArrangement}
            </p>
          )}
        </div>
        <ChevronRight size={16} className="text-muted flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

// ─── Running order ────────────────────────────────────────────────────────────

function SetRow({ set }: { set: PerformanceSet }) {
  const parts = [set.label, formatDuration(set.duration), set.startTime].filter(Boolean);
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted w-4 flex-shrink-0 text-right">{set.order}</span>
      <span className="text-sm text-foreground">{parts.join(' · ')}</span>
    </div>
  );
}

function RunningOrderCard({ sets }: { sets: PerformanceSet[] }) {
  return (
    <Card title="Running order">
      {sets.length === 0 ? (
        <div className="flex items-center gap-2 text-muted py-1">
          <Music size={14} />
          <span className="text-sm">No sets added</span>
        </div>
      ) : (
        <div>
          {sets.map((set) => <SetRow key={set.id} set={set} />)}
        </div>
      )}
    </Card>
  );
}

// ─── Venue card ───────────────────────────────────────────────────────────────

function VenueCard({ venue, linkState }: { venue: Contact; linkState?: Record<string, string> }) {
  const contactLine = [venue.email, venue.phone].filter(Boolean).join(' · ');
  return (
    <Card title="Venue">
      <Link
        to={`/admin/contacts/${venue.id}`}
        state={linkState}
        className="inline-flex items-center gap-1 group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {venue.name}
        </span>
        <ChevronRight size={14} className="text-muted group-hover:text-primary transition-colors" />
      </Link>
      {contactLine && <p className="text-sm text-muted mt-0.5">{contactLine}</p>}
      {venue.address && (
        <p className="text-sm text-muted mt-0.5 whitespace-pre-wrap">{venue.address}</p>
      )}
      {(venue.parkingInfo || venue.accessInfo || venue.equipmentAvailable) && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          {venue.parkingInfo && (
            <p className="text-sm text-muted">
              <span className="text-foreground">Parking</span>
              {' · '}{venue.parkingInfo}
            </p>
          )}
          {venue.accessInfo && (
            <p className="text-sm text-muted">
              <span className="text-foreground">Access</span>
              {' · '}{venue.accessInfo}
            </p>
          )}
          {venue.equipmentAvailable && (
            <p className="text-sm text-muted">
              <span className="text-foreground">Equipment</span>
              {' · '}{venue.equipmentAvailable}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const overdue =
    invoice.status === 'SENT' &&
    !!invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();
  const total = invoiceLineTotal(invoice);

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{invoice.isDeposit ? 'Deposit' : 'Balance'}</p>
        <p className="text-xs text-muted mt-0.5">
          {dateFormatter.format(new Date(invoice.issueDate))}
          {invoice.dueDate && ` · due ${dateFormatter.format(new Date(invoice.dueDate))}`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-medium text-foreground">
          {currencyFormatter.format(total)}
        </span>
        <InvoiceStatusPill status={invoice.status} isOverdue={overdue} />
      </div>
    </div>
  );
}

// ─── Communications ───────────────────────────────────────────────────────────

function CommunicationRow({ comm }: { comm: Communication }) {
  const meta = [comm.template?.name, `To ${comm.contact.name}`].filter(Boolean).join(' · ');
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground truncate">{comm.subject}</p>
        <p className="text-xs text-muted mt-0.5">{meta}</p>
      </div>
      <span className="text-xs text-muted flex-shrink-0">
        {dateFormatter.format(new Date(comm.sentAt))}
      </span>
    </div>
  );
}

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
  const navigate = useNavigate();

  const { data: booking, isLoading, isError } = useBooking(id!);
  const { data: invoices = [], isPending: invoicesPending } = useBookingInvoices(id!);
  const { data: communications = [] } = useBookingCommunications(id!);

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
  const fee = formatFee(booking.fee);
  const checklist =
    booking.status !== 'CANCELLED'
      ? buildChecklist(booking, communications)
      : [];
  const backState = { from: `/admin/bookings/${id}`, label: title };

  return (
    <div className="px-4 md:px-6 py-6 max-w-2xl space-y-8">

      {/* Back */}
      <Link
        to="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        Bookings
      </Link>

      {/* 1. Header */}
      <section>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0"
            onClick={() => navigate(`/admin/bookings/${id}/edit`)}
          >
            Edit
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <BookingStatusPill status={booking.status} />
          <span className="text-sm text-muted">
            {dateFormatter.format(new Date(booking.date))}
          </span>
          {fee && <span className="text-sm text-muted">{fee}</span>}
        </div>
      </section>

      {/* 2. People */}
      <section>
        <SectionHeader label="People" />
        <div className="border-t border-border">
          <PersonCard role="Customer" contact={booking.customer} linkState={backState} />
          {booking.referrer && (
            <PersonCard
              role="Referrer"
              contact={booking.referrer}
              commissionArrangement={booking.referrer.commissionArrangement}
              linkState={backState}
            />
          )}
        </div>
      </section>

      {/* 3. Notes & Checklist */}
      {(booking.notes || (booking.status !== 'CANCELLED' && checklist.length > 0)) && (
        <div className={
          booking.notes && booking.status !== 'CANCELLED' && checklist.length > 0
            ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
            : undefined
        }>
          {booking.notes && (
            <section>
              <SectionHeader label="Notes" />
              <p className="text-sm text-muted whitespace-pre-wrap">{booking.notes}</p>
            </section>
          )}
          {booking.status !== 'CANCELLED' && checklist.length > 0 && (
            <section>
              <SectionHeader label="Checklist" />
              <div className="space-y-2.5">
                {checklist.map((item) => (
                  <div key={item.key} className="flex items-center gap-2.5">
                    {item.state === 'done' ? (
                      <CheckCircle2 size={16} className="text-status-confirmed flex-shrink-0" />
                    ) : (
                      <Circle size={16} className="text-muted flex-shrink-0" />
                    )}
                    <span
                      className={
                        item.state === 'done'
                          ? 'text-sm text-muted line-through'
                          : 'text-sm text-foreground'
                      }
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 4. For the day */}
      <section>
        <SectionHeader label="For the day" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RunningOrderCard sets={booking.sets} />
          {booking.venue && <VenueCard venue={booking.venue} linkState={backState} />}
        </div>
      </section>

      {/* 5. Finance */}
      <section>
        <SectionHeader label="Finance" />
        <div className="space-y-4">
          {/* Invoices */}
          <Card title="Invoices">
            {invoicesPending ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2].map((i) => <div key={i} className="h-9 bg-border rounded" />)}
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex items-center gap-2 text-muted py-1">
                <DollarSign size={14} />
                <span className="text-sm">No invoices yet</span>
              </div>
            ) : (
              <div>
                {invoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)}
              </div>
            )}
          </Card>

          {/* Documents */}
          <Card title="Documents">
            <div className="flex items-center gap-2 text-muted py-1">
              <FolderOpen size={14} />
              <span className="text-sm">No documents yet</span>
            </div>
          </Card>
        </div>
      </section>

      {/* 6. Communications */}
      <section>
        <SectionHeader label="Communications" />
        {communications.length === 0 ? (
          <div className="flex items-center gap-2 text-muted py-1">
            <FileText size={14} />
            <span className="text-sm">No emails sent yet</span>
          </div>
        ) : (
          <div className="border-t border-border">
            {communications.map((comm) => (
              <CommunicationRow key={comm.id} comm={comm} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
