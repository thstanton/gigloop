import type { BookingDetail } from '@/types/api';

/**
 * Comma-joined "label (N min)" summary of a booking's performance sets, used to prefill an invoice
 * description. A set's label falls back to its package label, then to the bare duration. Kept out of
 * invoiceDerivations because it derives from booking data, not an invoice.
 */
export function buildSetsDescription(booking: BookingDetail | undefined): string {
  if (!booking?.sets?.length) return '';
  const formatById = new Map(
    (booking.packages ?? []).map((f) => [f.id, f.label]),
  );
  return booking.sets
    .map((s) => {
      const label = s.label ?? (s.packageId ? formatById.get(s.packageId) : null) ?? null;
      return label ? `${label} (${s.duration} min)` : `${s.duration} min`;
    })
    .join(', ');
}
