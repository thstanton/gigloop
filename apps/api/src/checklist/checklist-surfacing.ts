// Single source of truth for which checklist items "surface" as action items on
// the action-oriented backend surfaces (dashboard Actions widget + email digest).
//
// This deliberately mirrors the booking-detail checklist's stage-relevance rule
// (apps/web ChecklistSection): an item gated to a stage the booking has already
// passed is water under the bridge and must not be surfaced. The detail view owns
// its own copy because it layers UI-density choices (current+next stage, a
// "Show all" toggle) on top; the backend surfaces instead layer a due-date cutoff
// ("relevant soon") on top. The shared, drift-prone part — the stage gate — lives
// here so the two backend consumers cannot diverge from each other.

// Booking lifecycle order. CANCELLED bookings never reach surfacing (filtered out
// of the queries), but it is included for completeness.
const STAGE_ORDER = ['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'];

export interface SurfaceableItem {
  dueDate: Date | null;
  requiredForStatus: string | null;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// An item required for a stage strictly earlier than the booking's current status
// is no longer actionable — the musician has moved the booking on past it.
// Exported so the per-concern reminder selector (checklist-reminders.ts) applies
// the *same* stage gate the surfaces do — the two cannot drift.
export function isPastStage(bookingStatus: string, requiredForStatus: string | null): boolean {
  if (requiredForStatus === null) return false;
  const current = STAGE_ORDER.indexOf(bookingStatus);
  const required = STAGE_ORDER.indexOf(requiredForStatus);
  if (current < 0 || required < 0) return false;
  return required < current;
}

// Filters a booking's outstanding (PENDING/FAILED, completedBy USER) checklist
// items down to those worth surfacing now. Consumers decide how many to take
// (dashboard shows the first; digest shows all).
export function surfaceActionItems<T extends SurfaceableItem>(
  items: T[],
  bookingStatus: string,
  cutoff: Date,
): T[] {
  return items.filter((item) => {
    // Stage gate (shared with the detail view): drop past-stage requirements.
    if (isPastStage(bookingStatus, item.requiredForStatus)) return false;
    // Dated items surface once their due date falls within the lead window.
    if (item.dueDate !== null) return item.dueDate <= cutoff;
    // Undated status-gate items surface only when they are the sole remaining
    // blocker for that status transition.
    if (item.requiredForStatus !== null) {
      const peers = items.filter((i) => i.requiredForStatus === item.requiredForStatus);
      return peers.length === 1;
    }
    return false;
  });
}
