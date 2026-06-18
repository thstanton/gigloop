import { useAuth } from '@clerk/react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Pencil, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingFields } from '@/lib/hooks/useBookingFields';
import BookingStatusDropdown from '@/features/bookings/BookingStatusDropdown';
import InlineFeeAdd from '@/features/bookings/InlineFeeAdd';
import { apiGet } from '@/lib/api';
import { formatDate, formatCurrency, formatFee } from '@/lib/formatters';
import { DateBadge } from '@/components/common/DateBadge';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { UserProfile } from '@/types/api';

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

  return (
    <section className="mt-6">
      <div className="flex items-start gap-3">
        <DateBadge date={booking.date} size="lg" className="mt-0.5" />
        <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`/booking/${booking.portalToken}?preview=admin&from=${backUrl}`}
            className="inline-flex items-center justify-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors border border-border rounded h-9 w-9 md:w-auto md:px-3"
          >
            <Eye size={16} />
            <span className="hidden md:inline">Client portal</span>
          </a>
          <Button
            variant="outline"
            size="sm"
            className="w-9 px-0 md:w-auto md:px-3"
            onClick={() => setSearchParams({ sheet: 'bookingEdit' })}
          >
            <Pencil size={16} />
            <span className="hidden md:inline">Edit</span>
          </Button>
        </div>
      </div>
        <div className="flex items-center justify-between md:flex-wrap md:justify-start md:gap-x-3 md:gap-y-1 mt-1">
        <BookingStatusDropdown
          currentStatus={booking.status}
          checklist={[]}
          onStatusChange={(status) => fields.updateStatus(status)}
          isPending={fields.isStatusPending}
        />
        <span className="text-sm text-muted">{formatDate(booking.date)}</span>
        {feeWithVat
          ? <span className="text-sm text-muted">{feeWithVat}</span>
          : <InlineFeeAdd onSave={(fee) => fields.updateFee(fee)} isSaving={fields.isFeePending} />
        }
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
