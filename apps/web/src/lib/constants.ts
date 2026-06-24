import {
  Music, Mic2, Guitar, Piano, Drum, Church, Cake, Wine, Star, Heart,
  GlassWater, Utensils, Moon, Briefcase, Music2, Sparkles, Radio, Headphones,
  Volume2, Users, Clock, Shirt, Sofa, type LucideIcon,
} from 'lucide-react';
import type { BookingStatus, EventType, ReminderConcern, SongGenre } from '@/types/api';

export type ContactPrimaryRole = 'CUSTOMER' | 'VENUE' | 'BOOKING_AGENT';

export const PRIMARY_ROLE_LABELS: Record<ContactPrimaryRole, string> = {
  CUSTOMER:      'Customer',
  VENUE:         'Venue',
  BOOKING_AGENT: 'Booking agent',
};

export const PRIMARY_ROLE_ORDER: ContactPrimaryRole[] = [
  'CUSTOMER', 'VENUE', 'BOOKING_AGENT',
];

export const GENRE_LABELS: Record<SongGenre, string> = {
  CONTEMPORARY:    'Contemporary',
  CLASSICAL:       'Classical',
  JAZZ:            'Jazz',
  FILM_TV_MUSICALS:'Film, TV & Musicals',
  BOLLYWOOD:       'Bollywood',
  CHRISTMAS:       'Christmas',
};

export const ALL_GENRES = Object.keys(GENRE_LABELS) as SongGenre[];

// Seeded into a booking's MusicFormConfig.enabledGenres when the music form is turned on
// without a package to copy format defaults from (#535). Mirrors a typical
// PackageTemplate.defaultGenreSelection so the client's song list has genre tabs from the
// off — turning on with `[]` left the portal with no tabs (dead on arrival). Making this
// musician-configurable and library-aware is deferred (#530).
export const DEFAULT_ENABLED_GENRES: SongGenre[] = [
  'CONTEMPORARY',
  'CLASSICAL',
  'JAZZ',
  'FILM_TV_MUSICALS',
];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WEDDING:   'Wedding',
  CORPORATE: 'Corporate',
  PRIVATE:   'Private event',
  RESIDENCY: 'Residency',
  FESTIVAL:  'Festival',
  OUTDOOR:   'Outdoor event',
  FUNCTION:  'Function',
  OTHER:     'Other',
};

export const STATUS_ORDER: BookingStatus[] = [
  'ENQUIRY',
  'PROVISIONAL',
  'CONFIRMED',
  'READY',
  'COMPLETE',
  'CANCELLED',
];

export const CHECKLIST_STAGE_ORDER: Array<BookingStatus | null> = [
  null,
  'ENQUIRY',
  'PROVISIONAL',
  'CONFIRMED',
  'READY',
  'COMPLETE',
];

export function statusGte(current: BookingStatus, threshold: BookingStatus): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  ENQUIRY:     'Enquiry',
  PROVISIONAL: 'Provisional',
  CONFIRMED:   'Confirmed',
  READY:       'Ready',
  COMPLETE:    'Complete',
  CANCELLED:   'Cancelled',
};

// Point-of-use distillation of the CONTEXT lifecycle canon (the [[Booking]] lifecycle
// definitions). The single source for status-meaning copy — the create form's coaching
// control reads it so there is no parallel copy to drift. Each describes what the status
// *means*, not how often it is chosen (the creation default is a per-user setting). ADR-0053.
export const STATUS_DESCRIPTIONS: Record<BookingStatus, string> = {
  ENQUIRY:     'Initial interest. You haven’t sent a quote yet, or it’s not been accepted.',
  PROVISIONAL: 'The client has agreed your quote in principle. Contract and deposit are still to come.',
  CONFIRMED:   'Locked in — contract signed and deposit received.',
  READY:       'Fully prepped — balance invoiced, music form in, logistics resolved.',
  COMPLETE:    'Played and wrapped up — thank-you sent, post-gig admin done.',
  CANCELLED:   'Cancelled at any point in the lifecycle.',
};

// The forward lifecycle statuses offered when creating a booking, in order. Cancelled is
// excluded — you don't create a cancelled booking. Ready and Complete are legitimate
// creation statuses (a no-prep series gig; backfilling an already-played gig). ADR-0053.
export const CREATABLE_BOOKING_STATUSES: BookingStatus[] = [
  'ENQUIRY',
  'PROVISIONAL',
  'CONFIRMED',
  'READY',
  'COMPLETE',
];

export const PACKAGE_CATEGORY_LABELS: Record<string, string> = {
  WEDDING:   'Wedding',
  CORPORATE: 'Corporate',
  PRIVATE:   'Private',
  RESIDENCY: 'Residency',
  FESTIVAL:  'Festival',
  OUTDOOR:   'Outdoor',
  FUNCTION:  'Function',
  OTHER:     'Other',
};

export const PACKAGE_CATEGORY_ORDER = [
  'WEDDING', 'CORPORATE', 'PRIVATE', 'RESIDENCY', 'FESTIVAL', 'OUTDOOR', 'FUNCTION', 'OTHER',
] as const;

export const LOGISTICS_FIELD_LABELS: Record<string, string> = {
  arrivalTime:    'Arrival time',
  soundCheckTime: 'Soundcheck time',
  finishTime:     'Finish time',
  dressCode:      'Dress code',
  performanceSpace: 'Performance space',
  foodProvided:   'Food provided',
  greenRoom:      'Green room',
  equipmentRequired: 'Equipment required',
};

export const PACKAGE_ICON_MAP: Record<string, LucideIcon> = {
  clock: Clock,
  music: Music,
  'mic-2': Mic2,
  guitar: Guitar,
  piano: Piano,
  drum: Drum,
  church: Church,
  cake: Cake,
  wine: Wine,
  star: Star,
  heart: Heart,
  'glass-water': GlassWater,
  utensils: Utensils,
  moon: Moon,
  briefcase: Briefcase,
  'music-2': Music2,
  sparkles: Sparkles,
  radio: Radio,
  headphones: Headphones,
  'volume-2': Volume2,
  users: Users,
  shirt: Shirt,
  sofa: Sofa,
};

export const PACKAGE_ICON_OPTIONS = Object.keys(PACKAGE_ICON_MAP);

export const LOGISTICS_FIELD_ICONS: Record<string, string> = {
  arrivalTime:       'clock',
  soundCheckTime:    'music',
  finishTime:        'moon',
  dressCode:         'shirt',
  performanceSpace:  'mic-2',
  foodProvided:      'utensils',
  greenRoom:         'sofa',
  equipmentRequired: 'volume-2',
};

export const DRESS_CODE_OPTIONS = [
  'Smart Casual',
  'Formal',
  'Black Tie',
  'Morning Dress',
  'Casual',
  'Cocktail',
];

// The reminder concerns, in Builder spine order — the order the New Booking form (#560) renders the
// per-concern "Remind me about" controls so the create surface matches the Builder.
export const REMINDER_CONCERN_ORDER: ReminderConcern[] = [
  'overview', 'people', 'venue', 'itinerary', 'music',
];

export const REMINDER_CONCERN_LABELS: Record<ReminderConcern, string> = {
  overview: 'Overview',
  people: 'People',
  venue: 'Venue',
  itinerary: 'Itinerary',
  music: 'Music',
};
