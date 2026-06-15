// Pure, side-effect-free reconciliation for series draft invoice line items.
// Keyed on sourceBookingId: custom lines (null source) are never touched.

export interface ExistingLine {
  id: string;
  sourceBookingId: string | null;
}

export interface MemberBooking {
  id: string;
  description: string;
  amount: number;
}

export interface ReconcileResult {
  add: MemberBooking[];
  removeIds: string[];
}

/**
 * Diff existing sourced lines against the current member list.
 * Returns lines to add (bookings with no matching line) and IDs to remove
 * (lines whose source booking is no longer a member).
 * Custom lines (null sourceBookingId) and manual edits to traced lines are untouched.
 */
export function reconcile(existingLines: ExistingLine[], memberBookings: MemberBooking[]): ReconcileResult {
  const lineByBookingId = new Map<string, string>();
  for (const line of existingLines) {
    if (line.sourceBookingId !== null) {
      lineByBookingId.set(line.sourceBookingId, line.id);
    }
  }

  const memberIds = new Set(memberBookings.map((b) => b.id));

  const add = memberBookings.filter((b) => !lineByBookingId.has(b.id));
  const removeIds: string[] = [];
  for (const [bookingId, lineId] of lineByBookingId) {
    if (!memberIds.has(bookingId)) removeIds.push(lineId);
  }

  return { add, removeIds };
}
