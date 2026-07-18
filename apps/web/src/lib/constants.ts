import {
  Music, Mic2, Guitar, Piano, Drum, Church, Cake, Wine, Star, Heart,
  GlassWater, Utensils, Moon, Briefcase, Music2, Sparkles, Radio, Headphones,
  Volume2, Users, Clock, Shirt, Sofa, type LucideIcon,
} from 'lucide-react';
import type { BookingStatus, EventType, PortalTheme, PortalVisibilityReason, ReminderConcern, SongGenre } from '@/types/api';

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

// System checklist goals that only apply when the musician's song-request form is enabled.
// Gated in the Settings configurator (locked off when the form is disabled). Kept as a single
// key reference — not a duplicate of the backend goal catalogue (the #615 single-source rule):
// the catalogue carries no music-gating flag, so the one gated goal is named here. If a second
// gated goal ever appears, prefer surfacing the flag on the defaults contract (a #620 concern).
export const MUSIC_FORM_GATED_CHECKLIST_KEYS: readonly string[] = ['gather_song_requests'];

export function statusGte(current: BookingStatus, threshold: BookingStatus): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}

// The five forward lifecycle stages, in order — STATUS_ORDER minus the CANCELLED off-ramp.
// COMPLETE is terminal: no goals are worked on during it.
export const FORWARD_STATUSES: BookingStatus[] = STATUS_ORDER.filter((s) => s !== 'CANCELLED');

// A goal is worked on — and reminded about — during the stage BEFORE its requiredForStatus
// (e.g. a goal required FOR Confirmed is chased while still Provisional). Derived from the
// forward order so it cannot drift if a stage is ever added.
export function statusBefore(status: BookingStatus): BookingStatus | null {
  const i = FORWARD_STATUSES.indexOf(status);
  return i > 0 ? FORWARD_STATUSES[i - 1] : null;
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

// Per-status accent background class (the lifecycle colour tokens shared by BookingStatusPill and
// StatusCoachingField's `accent`). Used as a small status marker where a full pill would be too
// heavy — e.g. the onboarding "How GigLoop runs your bookings" stage headers (#661).
export const STATUS_ACCENT_BG: Record<BookingStatus, string> = {
  ENQUIRY:     'bg-status-enquiry',
  PROVISIONAL: 'bg-status-provisional',
  CONFIRMED:   'bg-status-confirmed',
  READY:       'bg-status-ready',
  COMPLETE:    'bg-status-complete',
  CANCELLED:   'bg-status-cancelled',
};

// Plain-English overview of what each default checklist goal's journey includes (distilled from
// its steps), shown in the onboarding "How GigLoop runs your bookings" orientation step (#661).
// Keyed by the goal's catalogue key. A goal with no entry here simply shows no summary line.
export const GOAL_SUMMARIES: Record<string, string> = {
  get_the_quote_accepted: 'Set your fee and email the quote — GigLoop nudges you to chase the client until they say yes.',
  get_deposit_paid:       'Create, issue and send the deposit invoice, then GigLoop tracks the payment landing.',
  get_contract_signed:    'Draft the contract and send it over — the client signs it online.',
  add_venue:              'Pop in the venue once it’s booked so travel and logistics are ready.',
  build_itinerary:        'Set out your sets and running order for the day.',
  get_the_balance_paid:   'Send the balance invoice as the gig nears, then GigLoop tracks it paid.',
  gather_song_requests:   'Publish your music form and invite the client — they add requests when ready.',
  play_the_gig:           'The big day — mark it played when you’re done.',
  send_thank_you:         'A week after, GigLoop reminds you to send a thank-you.',
};

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

// The muted "Not visible …" hint copy for each portal-visibility ReasonCode (ADR-0054). The API
// returns the stable ReasonCode; this is the only place the English lives. The visible state needs
// no map — it is always "Visible on Client Portal".
export const PORTAL_VISIBILITY_REASON_COPY: Record<PortalVisibilityReason, string> = {
  until_sent:      'Not visible until sent',
  until_published: 'Not visible until published',
  voided:          'Not visible — voided',
  not_shared:      'Not visible to client',
  cancelled:       'Not visible — cancelled',
};

// Portal theme choices, in display order. Consumed by the shared branding controls
// (features/portal/BrandingControls) and anywhere a theme needs labelling.
export const PORTAL_THEME_OPTIONS: { value: PortalTheme; label: string; description: string }[] = [
  { value: 'LIGHT_MODERN',   label: 'Light Modern',   description: 'Clean, sans-serif' },
  { value: 'LIGHT_ROMANTIC', label: 'Light Romantic', description: 'Soft, script font' },
  { value: 'BOLD_MODERN',    label: 'Bold Modern',    description: 'Dark, contemporary' },
  { value: 'BOLD_ROMANTIC',  label: 'Bold Romantic',  description: 'Dark, elegant script' },
];

// Onboarding wizard steps (PRD #478 — 5-step guided activation). The single source of
// truth for the wizard order, progress-indicator labels, and each step's route. Step
// pages derive their prev/next targets from this order via stepNav() (features/onboarding/steps),
// so the sequence can never drift between the indicator and the pages. Step 1 is required;
// steps 2–5 are skippable. The `label` is the short pill caption; the full step title lives
// on each page's PageHeader.
export interface OnboardingStep {
  path: string;
  label: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { path: '/onboarding/profile',   label: 'Business' },
  { path: '/onboarding/checklist', label: 'Bookings' },
  { path: '/onboarding/packages',  label: 'Packages' },
  { path: '/onboarding/portal',    label: 'Portal' },
  { path: '/onboarding/songs',     label: 'Songs' },
];
