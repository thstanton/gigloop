import { CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Shared Booking Builder completeness vocabulary (PRD #511 Module C).
// Kept feature-local so the desktop CompletenessRail and the mobile
// MobileBuilderStepper render the *same* status glyphs and can never drift.
// The spine layout and the buildCompletenessMap predicate stay in
// BookingBuilderPage — the page computes status and passes it down, so the
// only thing that genuinely needs sharing is the status → icon mapping.

export type SpineId =
  | 'overview'
  | 'people'
  | 'venue'
  | 'templates'
  | 'itinerary'
  | 'details'
  | 'music'
  | 'notes';

// Only People, Venue and Itinerary report a status; the other five concerns
// make no completeness claim and resolve to null.
export type CompletenessStatus = 'set' | 'partial' | 'unset' | 'empty' | null;

// `className` overrides the default status colour — the stepper passes
// text-primary-foreground so the glyph reads white on a filled active node.
export function CompletenessStatusIcon({
  status,
  className,
}: {
  status: CompletenessStatus;
  className?: string;
}) {
  if (status === 'set') {
    return <CheckCircle2 size={14} className={cn('text-status-confirmed flex-shrink-0', className)} aria-label="Complete" />;
  }
  if (status === 'partial') {
    return <MinusCircle size={14} className={cn('text-status-provisional flex-shrink-0', className)} aria-label="Partial" />;
  }
  if (status === 'unset' || status === 'empty') {
    return <Circle size={14} className={cn('text-border flex-shrink-0', className)} aria-label="Incomplete" />;
  }
  return null;
}
