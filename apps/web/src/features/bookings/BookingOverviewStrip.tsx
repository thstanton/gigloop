import { useAuth } from '@clerk/react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Wrench, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import BookingStatusDropdown from '@/features/bookings/BookingStatusDropdown';
import { apiGet } from '@/lib/api';
import { formatDate, formatCurrency, formatFee } from '@/lib/formatters';
import { DateBadge } from '@/components/common/DateBadge';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { UserProfile } from '@/types/api';

// PRD #511 Module B — the Overview concern. Per the card-topology grill, Overview is the ONE
// concern that is not a stacked card: it IS the header strip. A ghost pencil (top-right of the
// overview region) opens the Overview atom as a quick-tweak (?sheet=overviewTweak) — same
// pencil->atom mechanism as every other concern card, just located on the header. A subtle
// vertical divider splits the overview region from the page-actions region (Client portal +
// Builder). Status is shown here but its control stays the standalone status-transition dropdown,
// never folded into the atom.

interface BookingOverviewStripProps {
  bookingId: string;
}

export default function BookingOverviewStrip({ bookingId }: BookingOverviewStripProps) {
  const { isLoaded } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const { data: booking } = useBooking(bookingId);
  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const fields = useBookingFields(bookingId);

  if (!booking) return null;

  const title = booking.title ?? EVENT_TYPE_LABELS[booking.eventType];
  const fee = formatFee(booking.fee);
  const feeWithVat = userProfile?.vatNumber && booking.fee
    ? `${fee} (${formatCurrency(parseFloat(booking.fee) * (1 + (userProfile.vatRate ?? 20) / 100))} inc. VAT)`
    : fee;

  const backUrl = encodeURIComponent(`/admin/bookings/${booking.id}`);
  const openOverview = () => setSearchParams({ sheet: 'overviewTweak' });

  return (
    <section className="mt-6">
      <div className="flex items-start gap-3">
        <DateBadge date={booking.date} size="lg" className="mt-0.5" />

        <div className="flex-1 min-w-0">
          {/* ─── Top row: title | ghost pencil | divider | page actions. ───
              The divider lives in this row so it spans only the top row's height (not the meta
              below), and the pencil is pushed right — next to the divider — by the flex-1 title. */}
          <div className="flex items-start gap-3 md:gap-4">
            {/* Title wraps on mobile, never truncates. */}
            <h1 className="flex-1 min-w-0 break-words font-display text-2xl font-semibold text-foreground">
              {title}
            </h1>

            <button
              type="button"
              onClick={openOverview}
              aria-label="Edit overview"
              className="mt-1.5 flex-shrink-0 text-muted hover:text-foreground transition-colors p-1"
            >
              <Pencil size={15} />
            </button>

            <div className="self-stretch w-px bg-border flex-shrink-0" aria-hidden="true" />

            {/* Page actions — Portal, then Builder in the prominent slot. Kept horizontal at all
                widths so the top row stays short and the meta below sits beside the DateBadge
                (stacking the actions made the row tall and shunted the meta under the badge). */}
            <div className="flex flex-row gap-2 flex-shrink-0">
              <a
                href={`/booking/${booking.portalToken}?preview=admin&from=${backUrl}`}
                className="inline-flex items-center justify-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors border border-border rounded h-9 w-9 md:w-auto md:px-3"
              >
                <Eye size={16} />
                <span className="hidden md:inline">Client portal</span>
              </a>
              <Button
                size="sm"
                className="w-9 px-0 md:w-auto md:px-3"
                onClick={() => setSearchParams({ sheet: 'bookingEdit' })}
              >
                <Wrench size={16} />
                <span className="hidden md:inline">Builder</span>
              </Button>
            </div>
          </div>

          {/* ─── Meta, below the top row (indented under the title past the DateBadge). ─── */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1">
            <BookingStatusDropdown
              currentStatus={booking.status}
              checklist={[]}
              onStatusChange={(status) => fields.updateStatus(status)}
              isPending={fields.isStatusPending}
            />
            <span className="text-sm text-muted">{formatDate(booking.date)}</span>
            {feeWithVat ? (
              <span className="text-sm text-muted">{feeWithVat}</span>
            ) : (
              <button
                type="button"
                onClick={openOverview}
                className="text-sm text-muted hover:text-foreground transition-colors underline underline-offset-2"
              >
                + Add fee
              </button>
            )}
            {booking.series ? (
              <span className="hidden md:inline-flex items-center gap-1.5 text-sm text-foreground border border-border rounded-full px-3 py-1.5">
                {booking.series.label}
                <button
                  type="button"
                  onClick={() => fields.updateSeries({ seriesId: null })}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center -m-2 hover:text-foreground transition-colors"
                  aria-label="Remove from series"
                >
                  <X size={12} />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSearchParams({ sheet: 'series' })}
                className="hidden md:inline text-sm text-muted hover:text-foreground transition-colors underline underline-offset-2"
              >
                + Add to series
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
