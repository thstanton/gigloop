import { useDismissibleHint } from '@/lib/hooks/useDismissibleHint';
import { BookingConceptCard } from './BookingConceptCard';

/**
 * Wires the persisted dismissal (useDismissibleHint) into the presentational
 * BookingConceptCard. Mounted inside ChecklistSection, which only renders for
 * non-cancelled bookings — so the "not CANCELLED" requirement is satisfied
 * structurally by the mount point.
 */
export function BookingConceptCardContainer() {
  const { isDismissed, dismiss } = useDismissibleHint('booking-concept-card');
  return <BookingConceptCard isDismissed={isDismissed} onDismiss={dismiss} />;
}
