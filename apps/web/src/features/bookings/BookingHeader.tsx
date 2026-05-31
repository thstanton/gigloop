import { Button } from '@/components/ui/button';
import BookingStatusDropdown from '@/features/bookings/BookingStatusDropdown';
import InlineFeeAdd from '@/features/bookings/InlineFeeAdd';
import { formatDate, formatCurrency, formatFee } from '@/lib/formatters';
import { EVENT_TYPE_LABELS } from '@/lib/constants';
import type { BookingDetail, BookingStatus, ChecklistItem, UserProfile } from '@/types/api';

interface Props {
  booking: BookingDetail;
  checklist: ChecklistItem[];
  userProfile: UserProfile | undefined;
  onStatusChange: (status: BookingStatus) => void;
  isStatusPending: boolean;
  onFeeAdd: (fee: number) => void;
  isFeePending: boolean;
  onEdit: () => void;
}

export function BookingHeader({
  booking, checklist, userProfile,
  onStatusChange, isStatusPending,
  onFeeAdd, isFeePending, onEdit,
}: Props) {
  const title = booking.title ?? EVENT_TYPE_LABELS[booking.eventType];
  const fee = formatFee(booking.fee);
  const feeWithVat = userProfile?.vatNumber && booking.fee
    ? `${fee} (${formatCurrency(parseFloat(booking.fee) * (1 + (userProfile.vatRate ?? 20) / 100))} inc. VAT)`
    : fee;
  const backUrl = encodeURIComponent(`/admin/bookings/${booking.id}`);

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`/booking/${booking.portalToken}?preview=admin&from=${backUrl}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors border border-border rounded px-3 py-1.5"
          >
            Client portal
          </a>
          <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
        <BookingStatusDropdown
          currentStatus={booking.status}
          checklist={checklist}
          onStatusChange={onStatusChange}
          isPending={isStatusPending}
        />
        <span className="text-sm text-muted">{formatDate(booking.date)}</span>
        {feeWithVat
          ? <span className="text-sm text-muted">{feeWithVat}</span>
          : <InlineFeeAdd onSave={onFeeAdd} isSaving={isFeePending} />
        }
      </div>
    </section>
  );
}
