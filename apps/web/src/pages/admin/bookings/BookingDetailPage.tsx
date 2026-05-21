import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BookingStatusPill from '@/components/BookingStatusPill';
import InvoiceStatusPill from '@/components/InvoiceStatusPill';
import { useBooking } from '@/features/bookings/useBooking';
import { useBookingInvoices } from '@/features/bookings/useBookingInvoices';
import type { Contact, PerformanceSet, Invoice, EventType } from '@/types/api';

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

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="py-3 grid grid-cols-[140px_1fr] gap-4 border-b border-border last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-foreground whitespace-pre-wrap">{value}</span>
    </div>
  );
}

// ─── PreConfirmRow ────────────────────────────────────────────────────────────

function PreConfirmRow({
  label,
  value,
  noneText,
}: {
  label: string;
  value: string | null;
  noneText: string;
}) {
  return (
    <div className="py-3 grid grid-cols-[140px_1fr] gap-4 border-b border-border last:border-0">
      <span className="text-sm text-muted">{label}</span>
      {value ? (
        <span className="text-sm text-foreground">
          {dateFormatter.format(new Date(value))}
        </span>
      ) : (
        <span className="text-sm text-muted">{noneText}</span>
      )}
    </div>
  );
}

// ─── PersonCard ───────────────────────────────────────────────────────────────

function PersonCard({
  role,
  contact,
  showVenueDetails,
  showCommission,
}: {
  role: string;
  contact: Contact;
  showVenueDetails?: boolean;
  showCommission?: boolean;
}) {
  const contactLine = [contact.email, contact.phone].filter(Boolean).join(' · ');
  const hasVenueDetails =
    showVenueDetails &&
    (contact.parkingInfo || contact.accessInfo || contact.equipmentAvailable);

  return (
    <div className="py-4 border-b border-border last:border-0">
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5">{role}</p>
      <Link
        to={`/admin/contacts/${contact.id}`}
        className="text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        {contact.name}
      </Link>
      {contactLine && (
        <p className="text-sm text-muted mt-0.5">{contactLine}</p>
      )}
      {contact.address && (
        <p className="text-sm text-muted mt-0.5 whitespace-pre-wrap">{contact.address}</p>
      )}
      {hasVenueDetails && (
        <div className="mt-3 space-y-1.5">
          {contact.parkingInfo && (
            <p className="text-sm text-muted">
              <span className="text-foreground">Parking</span>
              {' '}· {contact.parkingInfo}
            </p>
          )}
          {contact.accessInfo && (
            <p className="text-sm text-muted">
              <span className="text-foreground">Access</span>
              {' '}· {contact.accessInfo}
            </p>
          )}
          {contact.equipmentAvailable && (
            <p className="text-sm text-muted">
              <span className="text-foreground">Equipment</span>
              {' '}· {contact.equipmentAvailable}
            </p>
          )}
        </div>
      )}
      {showCommission && contact.commissionArrangement && (
        <p className="text-sm text-muted mt-1.5">
          <span className="text-foreground">Commission</span>
          {' '}· {contact.commissionArrangement}
        </p>
      )}
    </div>
  );
}

// ─── SetRow ───────────────────────────────────────────────────────────────────

function SetRow({ set }: { set: PerformanceSet }) {
  const detail = [set.label, formatDuration(set.duration), set.startTime]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="py-3 flex items-start gap-4 border-b border-border last:border-0">
      <span className="text-sm text-muted w-5 flex-shrink-0 text-right">{set.order}</span>
      <span className="text-sm text-foreground">{detail}</span>
    </div>
  );
}

// ─── InvoiceRow ───────────────────────────────────────────────────────────────

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const overdue =
    invoice.status === 'SENT' &&
    !!invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();

  const total = invoiceLineTotal(invoice);

  return (
    <div className="py-3 flex items-start justify-between gap-3 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {invoice.isDeposit ? 'Deposit invoice' : 'Invoice'}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {dateFormatter.format(new Date(invoice.issueDate))}
          {invoice.dueDate && (
            <>
              {' '}· due {dateFormatter.format(new Date(invoice.dueDate))}
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <span className="text-sm font-medium text-foreground">
          {currencyFormatter.format(total)}
        </span>
        <InvoiceStatusPill status={invoice.status} isOverdue={overdue} />
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-6 py-8 max-w-2xl animate-pulse space-y-6">
      <div className="h-4 w-24 bg-border rounded" />
      <div className="space-y-2">
        <div className="h-7 w-56 bg-border rounded" />
        <div className="h-5 w-32 bg-border rounded" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 w-full bg-border rounded" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-full bg-border rounded" />
        ))}
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

  if (isLoading) return <PageSkeleton />;

  if (isError || !booking) {
    return (
      <div className="px-6 py-8">
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

  return (
    <div className="px-6 py-8 max-w-2xl">

      {/* Back */}
      <Link
        to="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        Bookings
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/admin/bookings/${id}/edit`)}
        >
          Edit
        </Button>
      </div>
      <div className="flex items-center gap-3 mb-8">
        <BookingStatusPill status={booking.status} />
        <span className="text-sm text-muted">
          {dateFormatter.format(new Date(booking.date))}
        </span>
      </div>

      {/* Details */}
      <div className="border-t border-border mb-8">
        <InfoRow label="Event type" value={EVENT_TYPE_LABELS[booking.eventType]} />
        <InfoRow label="Date" value={dateFormatter.format(new Date(booking.date))} />
        <InfoRow label="Fee" value={formatFee(booking.fee)} />
        <InfoRow label="Notes" value={booking.notes} />
      </div>

      {/* Pre-confirmation */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-1">Pre-confirmation</h2>
        <div className="border-t border-border">
          <PreConfirmRow
            label="Contract signed"
            value={booking.contractSignedAt}
            noneText="Not signed"
          />
          <PreConfirmRow
            label="Deposit received"
            value={booking.depositReceivedAt}
            noneText="Not received"
          />
        </div>
      </div>

      {/* People */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-1">People</h2>
        <div className="border-t border-border">
          <PersonCard role="Customer" contact={booking.customer} />
          {booking.venue && (
            <PersonCard role="Venue" contact={booking.venue} showVenueDetails />
          )}
          {booking.referrer && (
            <PersonCard role="Referrer" contact={booking.referrer} showCommission />
          )}
        </div>
      </div>

      {/* Performance sets */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Sets
          {booking.sets.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              ({booking.sets.length})
            </span>
          )}
        </h2>
        {booking.sets.length === 0 ? (
          <p className="text-sm text-muted py-4">No sets added.</p>
        ) : (
          <div className="border-t border-border">
            {booking.sets.map((set) => (
              <SetRow key={set.id} set={set} />
            ))}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Invoices
          {invoices.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              ({invoices.length})
            </span>
          )}
        </h2>
        {invoicesPending ? (
          <div className="space-y-3 pt-4 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-border rounded" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted py-4">No invoices yet.</p>
        ) : (
          <div className="border-t border-border">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
