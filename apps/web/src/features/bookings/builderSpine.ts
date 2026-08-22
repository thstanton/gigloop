import {
  CalendarClock,
  FileText,
  ListOrdered,
  MapPin,
  Music,
  Package,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { SpineId } from '@/features/bookings/builderCompleteness';

// The Booking Builder's spine (PRD #511 Module C): the fixed, ordered list of
// concerns the page, the completeness rail, the mobile stepper and the
// exit-backstop dialog all derive from. Declared once so section composition
// can be driven from it rather than hand-written per consumer.
export const SPINE: Array<{ id: SpineId; label: string; Icon: LucideIcon }> = [
  { id: 'overview',   label: 'Overview',          Icon: CalendarClock },
  { id: 'people',     label: 'People',             Icon: Users },
  { id: 'venue',      label: 'Venue',              Icon: MapPin },
  { id: 'templates',  label: 'Package Templates',  Icon: Package },
  { id: 'itinerary',  label: 'Itinerary',          Icon: ListOrdered },
  { id: 'details',    label: 'Details',            Icon: FileText },
  { id: 'music',      label: 'Music',              Icon: Music },
  { id: 'notes',      label: 'Notes',              Icon: StickyNote },
];

// Stable element-id list for the scroll-spy (module-level so the observer isn't
// rebuilt each render). Mirrors the BuilderSection `id={`builder-${id}`}`.
export const SECTION_DOM_IDS = SPINE.map(({ id }) => `builder-${id}`);
