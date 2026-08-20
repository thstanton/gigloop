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

export interface OrderedLine {
  id: string;
  order: number;
  sourceBookingId: string | null;
  /** The source booking's date — null for a custom line, or an auto line whose source was deleted. */
  sourceBookingDate: Date | null;
}

export interface JoinInsertion {
  /** The order value the newly-joined line should be created with. */
  newOrder: number;
  /** Existing lines whose order must change to make room — only entries that actually moved. */
  reorder: Array<{ id: string; order: number }>;
}

/**
 * Compute where a newly-joined booking's line belongs among a draft invoice's existing lines
 * (#851). Auto-generated lines (`sourceBookingId` set) are kept in date order — the new line is
 * inserted at its date position among them, re-sorting by date rather than trusting the existing
 * `order` so a series joined out of order under the pre-fix bug self-heals on the next join.
 * Custom lines (`sourceBookingId` null) always sort after every auto-generated line and keep
 * their relative order — they are never re-dated, since they have no source booking to date by.
 */
export function computeJoinInsertion(existingLines: OrderedLine[], newBookingDate: Date): JoinInsertion {
  const byOrder = (a: OrderedLine, b: OrderedLine) => a.order - b.order;
  const byDate = (a: OrderedLine, b: OrderedLine) =>
    (a.sourceBookingDate?.getTime() ?? 0) - (b.sourceBookingDate?.getTime() ?? 0);

  const autoLines = existingLines.filter((l) => l.sourceBookingId !== null).sort(byDate);
  const customLines = existingLines.filter((l) => l.sourceBookingId === null).sort(byOrder);

  const insertAt = autoLines.findIndex((l) => l.sourceBookingDate !== null && l.sourceBookingDate > newBookingDate);
  const position = insertAt === -1 ? autoLines.length : insertAt;

  const orderedIds: Array<string | null> = [
    ...autoLines.slice(0, position).map((l) => l.id),
    null, // the new line
    ...autoLines.slice(position).map((l) => l.id),
    ...customLines.map((l) => l.id),
  ];

  const byId = new Map(existingLines.map((l) => [l.id, l]));
  let newOrder = 0;
  const reorder: Array<{ id: string; order: number }> = [];
  orderedIds.forEach((id, order) => {
    if (id === null) {
      newOrder = order;
      return;
    }
    if (byId.get(id)!.order !== order) reorder.push({ id, order });
  });

  return { newOrder, reorder };
}
