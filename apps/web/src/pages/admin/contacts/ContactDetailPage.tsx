import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { LabelValue } from '@/components/common/LabelValue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import BookingStatusPill from '@/components/common/BookingStatusPill';
import { useContact } from '@/lib/hooks/useContact';
import { formatDate } from '@/lib/formatters';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import ContactEditDrawer from '@/features/contacts/ContactEditDrawer';
import type { BookingRef, BookingStatus, ContactDetail as ContactDetailType } from '@/types/api';

const PRIMARY_ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  VENUE: 'Venue',
  BOOKING_AGENT: 'Booking agent',
};

function buildNewBookingState(contact: ContactDetailType): { customerId?: string; venueId?: string; bookingAgentId?: string } {
  switch (contact.primaryRole) {
    case 'VENUE': return { venueId: contact.id };
    case 'BOOKING_AGENT': return { bookingAgentId: contact.id };
    default: return { customerId: contact.id };
  }
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  if (!value) return null;
  return (
    <LabelValue label={label}>
      {href
        ? <a href={href} className="hover:text-primary transition-colors">{value}</a>
        : <span className="whitespace-pre-wrap">{value}</span>
      }
    </LabelValue>
  );
}

// ─── Bookings list ────────────────────────────────────────────────────────────

type RoleBooking = BookingRef & { role: string };

function mergeBookings(
  customer: BookingRef[],
  venue: BookingRef[],
  bookingAgent: BookingRef[],
): RoleBooking[] {
  return [
    ...customer.map((b) => ({ ...b, role: 'Customer' })),
    ...venue.map((b) => ({ ...b, role: 'Venue' })),
    ...bookingAgent.map((b) => ({ ...b, role: 'Booking agent' })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function BookingsList({ bookings, fromState }: { bookings: RoleBooking[]; fromState?: { from: string; label: string } }) {
  const navigate = useNavigate();
  if (bookings.length === 0) {
    return <p className="text-sm text-muted py-4">No bookings associated with this contact.</p>;
  }
  return (
    <div className="divide-y divide-border">
      {bookings.map((b) => (
        <div
          key={`${b.role}-${b.id}`}
          onClick={() => navigate(`/admin/bookings/${b.id}`, fromState ? { state: fromState } : undefined)}
          className="py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-surface active:bg-surface transition-colors duration-100 -mx-1 px-1 rounded"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {b.title ?? EVENT_TYPE_LABELS[b.eventType] ?? b.eventType}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {formatDate(b.date)} · {b.role}
            </p>
            <div className="mt-1.5">
              <BookingStatusPill status={b.status as BookingStatus} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="px-6 py-8 max-w-2xl space-y-6 animate-pulse">
      <div className="h-4 w-24 bg-border rounded" />
      <div className="h-7 w-48 bg-border rounded" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-full bg-border rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const backNav = (location.state as { from?: string; label?: string } | null);

  const { data: contact, isLoading, isError } = useContact(id!);

  if (isLoading) return <DetailSkeleton />;
  if (isError || !contact) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm text-muted">Contact not found.</p>
        <Link to="/admin/contacts" className="text-sm text-primary underline underline-offset-2 mt-2 block">
          Back to contacts
        </Link>
      </div>
    );
  }

  const bookings = mergeBookings(
    contact.customerBookings,
    contact.venueBookings,
    contact.bookingAgentBookings,
  );

  const hasVenueDetails = contact.primaryRole === 'VENUE' && !!(contact.parkingInfo || contact.accessInfo || contact.equipmentAvailable);

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Back */}
      <Link
        to={backNav?.from ?? '/admin/contacts'}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        {backNav?.label ?? 'Contacts'}
      </Link>

      <div className="md:grid md:grid-cols-[3fr_2fr] md:gap-8 md:items-start">

        {/* ─── Left column ─── */}
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">{contact.name}</h1>
              {contact.primaryRole && (
                <Badge variant="secondary" className="mt-2">
                  {PRIMARY_ROLE_LABELS[contact.primaryRole] ?? contact.primaryRole}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/bookings/new`, { state: buildNewBookingState(contact) })}
              >
                <Plus size={14} className="mr-1" />
                New booking
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSearchParams({ edit: 'true' })}>
                Edit
              </Button>
            </div>
          </div>

          {/* Details */}
          <div className="border-t border-border mb-8">
            <InfoRow label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : undefined} />
            <InfoRow label="Phone" value={contact.phone} href={contact.phone ? `tel:${contact.phone}` : undefined} />
            <InfoRow label="Website" value={contact.website} />
            <InfoRow label="Address" value={[contact.addressLine1, contact.city, contact.postcode].filter(Boolean).join(', ') || null} />
            <InfoRow label="Notes" value={contact.notes} />
            <InfoRow label="Commission" value={contact.commissionArrangement} />
          </div>

          {/* Venue details */}
          {hasVenueDetails && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Venue details</h2>
              <div className="border-t border-border">
                <InfoRow label="Parking" value={contact.parkingInfo} />
                <InfoRow label="Access" value={contact.accessInfo} />
                <InfoRow label="Equipment" value={contact.equipmentAvailable} />
              </div>
            </div>
          )}
        </div>

        {/* ─── Right column ─── */}
        <div className="mt-8 md:mt-0 md:sticky md:top-20 md:max-h-[calc(100vh-5rem)] md:overflow-y-auto md:overflow-x-hidden md:pb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Bookings
            {bookings.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted">({bookings.length})</span>
            )}
          </h2>
          <BookingsList bookings={bookings} fromState={{ from: `/admin/contacts/${id}`, label: contact.name }} />
        </div>

      </div>

      <ContactEditDrawer contact={contact} />
    </div>
  );
}
