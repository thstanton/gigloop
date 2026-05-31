import PersonCard from '@/features/bookings/PersonCard';
import { SectionHeader } from '@/components/common/SectionHeader';
import type { BookingDetail, Contact } from '@/types/api';

interface Props {
  booking: BookingDetail;
  linkState: { from: string; label: string };
  onEdit: (contact: Contact) => void;
}

export function BookingPeople({ booking, linkState, onEdit }: Props) {
  return (
    <section>
      <SectionHeader label="People" />
      <div className="border-t border-border">
        <PersonCard
          role="Customer"
          contact={booking.customer}
          linkState={linkState}
          onEdit={() => onEdit(booking.customer)}
        />
        {booking.bookingAgent && (
          <PersonCard
            role="Booking agent"
            contact={booking.bookingAgent}
            commissionArrangement={booking.bookingAgent.commissionArrangement}
            linkState={linkState}
            onEdit={() => onEdit(booking.bookingAgent!)}
          />
        )}
      </div>
    </section>
  );
}
