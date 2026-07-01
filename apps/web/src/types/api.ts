// Wire-format types for all API endpoints.
// Kept in sync with apps/api/src/**/dto — update here whenever a DTO changes.
// Prisma-level types (Decimal, DateTime) appear here as their JSON equivalents
// (string). Enums are plain union types — no dependency on @prisma/client.

// ─────────────────────────────────────────
// Enums
// ─────────────────────────────────────────

export type BookingStatus =
  | 'ENQUIRY'
  | 'PROVISIONAL'
  | 'CONFIRMED'
  | 'READY'
  | 'COMPLETE'
  | 'CANCELLED';

export type EventType =
  | 'WEDDING'
  | 'CORPORATE'
  | 'PRIVATE'
  | 'RESIDENCY'
  | 'FESTIVAL'
  | 'OUTDOOR'
  | 'FUNCTION'
  | 'OTHER';

export type SongGenre =
  | 'CONTEMPORARY'
  | 'CLASSICAL'
  | 'JAZZ'
  | 'FILM_TV_MUSICALS'
  | 'BOLLYWOOD'
  | 'CHRISTMAS';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'VOID';

// ─────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────

export interface Contact {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  greetingName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  travelTimeMinutes: number | null;
  travelDistanceMetres: number | null;
  travelTimeCalculatedAt: string | null;
  travelMode: string | null;
  parkingInfo: string | null;
  accessInfo: string | null;
  equipmentAvailable: string | null;
  website: string | null;
  commissionArrangement: string | null;
  primaryRole: string | null;
}

export interface BookingRef {
  id: string;
  title: string | null;
  date: string;
  status: BookingStatus;
  eventType: EventType;
}

export interface ContactDetail extends Contact {
  customerBookings: BookingRef[];
  venueBookings: BookingRef[];
  bookingAgentBookings: BookingRef[];
}

export interface CreateContactInput {
  name: string;
  greetingName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  parkingInfo?: string;
  accessInfo?: string;
  equipmentAvailable?: string;
  website?: string;
  commissionArrangement?: string;
  primaryRole?: string | null;
}

export interface UpdateContactInput {
  name?: string;
  greetingName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  parkingInfo?: string | null;
  accessInfo?: string | null;
  equipmentAvailable?: string | null;
  website?: string | null;
  commissionArrangement?: string | null;
  primaryRole?: string | null;
}

// ─────────────────────────────────────────
// Series
// ─────────────────────────────────────────

export interface BookingSeries {
  id: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  customerId: string;
  customer: ContactSummary;
  memberBookingCount?: number;
  invoiceStatus?: string | null;
}

export interface SeriesInvoice {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  seriesId: string;
  billToContactId: string;
  billToContact: Contact;
  lineItems: InvoiceLineItem[];
}


// ─────────────────────────────────────────
// Bookings
// ─────────────────────────────────────────

export interface ContactSummary {
  id: string;
  name: string;
  email?: string | null;
}

export interface PerformanceSet {
  id: string;
  order: number;
  duration: number;
  startTime: string | null;
  label: string | null;
  packageId: string | null;
}

export interface BookingPackageSummary {
  id: string;
  order: number;
  label: string;
  icon: string;
}

export interface KeyMoment {
  label: string;
  section: string;
}

export interface MusicFormConfig {
  id: string;
  bookingId: string;
  keyMoments: KeyMoment[];
  enabledGenres: string[];
  createdAt: string;
  updatedAt: string;
}

/** Apply-time music-form suggestion offered when a template is applied while the form is on (ADR-0046). */
export interface MusicFormSuggestion {
  keyMoments: KeyMoment[];
  genres: string[];
}

/** Response from POST /bookings/:id/packages — the updated booking plus an optional suggestion. */
export interface ApplyPackageTemplateResponse {
  booking: BookingDetail;
  suggestion: MusicFormSuggestion | null;
}

export interface BookingListItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BookingStatus;
  eventType: EventType;
  date: string;
  title: string | null;
  fee: string | null; // Decimal serialises as string over JSON
  customerId: string;
  customer: ContactSummary;
  venueId: string | null;
  venue: ContactSummary | null;
  bookingAgentId: string | null;
  bookingAgent: ContactSummary | null;
  sets: { startTime: string | null }[];
  seriesId: string | null;
  series: { id: string; label: string } | null;
}

export type ContractStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID';

export interface Contract {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ContractStatus;
  content: unknown;
  signedAt: string | null;
}

// ADR-0057 / #609: BLOCKED retires. The active step is derived (first non-terminal), intra-goal
// order is intrinsic and inter-goal order is soft status — nothing produces BLOCKED any more.
export type ChecklistItemState = 'PENDING' | 'COMPLETE' | 'FAILED' | 'SKIPPED';

// A step's state never includes SKIPPED (the opt-out lives on the goal) — ADR-0057.
export type ChecklistStepState = 'PENDING' | 'COMPLETE' | 'FAILED';

// The concerns a reminder can belong to (ADR-0052). Mirrors the API's ReminderConcern.
export type ReminderConcern = 'overview' | 'people' | 'venue' | 'itinerary' | 'music';

// A step of a multi-step goal (ADR-0057). Mirrors BookingChecklistStepResponseDto. The
// active step (first non-terminal by order) and completed-step fold are derived client-side.
export interface ChecklistStep {
  id: string;
  key: string | null;
  label: string;
  order: number;
  kind: 'MILESTONE' | 'PRECONDITION' | 'FOLLOWUP';
  completeMode: 'ACTION' | 'AWAITED';
  state: ChecklistStepState;
  completedBy: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';
  completedAt: string | null;
  autoCompleteRule: Record<string, unknown> | null;
  // Derived server-side from autoCompleteRule (ADR-0057 / #611) so the active step routes its
  // action exactly like an atomic item. Absent for AWAITED steps the musician never acts on.
  shortcutType?: string;
  shortcutTemplateType?: string;
}

export interface ChecklistItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  bookingId: string;
  key: string | null;
  label: string;
  completedBy: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';
  state: ChecklistItemState;
  order: number;
  autoCompleteRule: Record<string, unknown> | null;
  requiredForStatus: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;
  completedAt: string | null;
  dueDate: string | null;
  dueDateRule: DueDateRule | null;
  // Per-concern reminder grouping. Null for concern-less custom items.
  concern: string | null;
  shortcutType?: string;
  shortcutTemplateType?: string;
  // Ordered steps of a multi-step goal (ADR-0057). Empty/absent for an atomic goal;
  // the goal state is the roll-up of these steps.
  steps?: ChecklistStep[];
}

// One row of a concern's "Remind me about" control (selector output).
export interface ApplicableReminder {
  itemId: string | null;
  key: string | null;
  label: string;
  on: boolean;
  source: 'system' | 'custom';
  state: ChecklistItemState | null;
  requiredForStatus: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;
  // Auto-complete condition ("when …" tail) for non-obvious/client-committed reminders; null
  // otherwise. Rendered after a tick icon in the control (#567).
  autoCompleteHint: string | null;
  // Dependency clause ("after you <phrase>"), present only while an unmet prerequisite is a live
  // gate (outstanding + tracked, per #554); null otherwise (#557/#558).
  after: string | null;
}

// One in-scope prerequisite of a previewed reminder (#560), with the phrase the New Booking form
// uses to recompute the "after you …" clause from the live selection.
export interface ReminderPrerequisite {
  key: string;
  phrase: string;
}

// One previewed system reminder for the New Booking form (#560). Pre-creation there is no booking
// to seed against, so the create surface previews the system reminders a booking started at a given
// status would offer — grouped by concern, with the same coaching as the Builder. Selection state
// (on/off) and the "after you …" clause live on the frontend; this is the static offer.
export interface ReminderPreview {
  key: string;
  label: string;
  concern: ReminderConcern;
  requiredForStatus: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;
  autoCompleteHint: string | null;
  prerequisites: ReminderPrerequisite[];
}

export interface BookingLogisticsEntry {
  value: string;
  icon?: string;
  notes?: string;
  shareWithBand: boolean;
  shareWithClient: boolean;
  label?: string;
}

export interface BookingDetail extends Omit<BookingListItem, 'customer' | 'venue' | 'bookingAgent'> {
  customer: Contact;
  venue: Contact | null;
  bookingAgent: Contact | null;
  sets: PerformanceSet[];
  packages: BookingPackageSummary[];
  activeContract: Contract | null;
  depositReceivedAt: string | null;
  portalToken: string;
  hasMusicFormConfig: boolean;
  hasMusicFormResponse: boolean;
  seriesId: string | null;
  series: { id: string; label: string; customerId: string } | null;
  logistics: Record<string, BookingLogisticsEntry> | null;
  notes: string | null;
  // Per-concern portal-visibility verdicts, computed by the single backend authority (ADR-0054).
  // A null verdict means the concern is not a live portal concern (no contract yet / music form off).
  portalVisibility: BookingPortalVisibility;
}

// Portal-visibility verdict (ADR-0054). The API returns a stable ReasonCode, never English —
// the reason → copy map lives frontend-side in lib/constants.ts. The full union is defined now;
// slice 1 (#578) only emits `until_sent`/`voided` (contract) — `not_shared`/`cancelled` arrive
// with the leak fixes (#579).
export type PortalVisibilityReason = 'until_sent' | 'voided' | 'not_shared' | 'cancelled';

export interface PortalVisibilityVerdict {
  visible: boolean;
  reason?: PortalVisibilityReason;
}

export interface BookingPortalVisibility {
  contract: PortalVisibilityVerdict | null;
  musicForm: PortalVisibilityVerdict | null;
}

export interface CreateSetInput {
  order: number;
  duration: number;
  startTime?: string;
  label?: string;
  packageId?: string;
}

export interface UpdateSetInput {
  order?: number;
  duration?: number;
  startTime?: string | null;
  label?: string | null;
}

export interface CreateBookingInput {
  eventType: EventType;
  date: string;
  customerId: string;
  status?: BookingStatus;
  title?: string;
  fee?: number;
  notes?: string;
  venueId?: string;
  bookingAgentId?: string;
  packageTemplateIds?: string[];
  /** Create the music form (song request form) on creation. Presence of the config row is the
   *  on/off truth — this only decides whether that row is created. Seeded from chosen packages. */
  enableMusicForm?: boolean;
  checklistItems: ChecklistDefaultItem[];
  seriesId?: string;
  newSeries?: { label: string };
}

export interface UpdateBookingInput {
  eventType?: EventType;
  date?: string;
  customerId?: string;
  status?: BookingStatus;
  title?: string | null;
  fee?: number | null;
  notes?: string | null;
  venueId?: string | null;
  bookingAgentId?: string | null;
}

export interface UpdateBookingSeriesInput {
  seriesId?: string | null;
  newSeriesLabel?: string;
  confirm?: boolean;
}

export interface UpdateBookingSeriesResponse {
  requiresConfirmation?: true;
  warning?: string;
}

// ─────────────────────────────────────────
// Invoices
// ─────────────────────────────────────────

export interface InvoiceLineItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  amount: string; // Decimal serialises as string
  order: number;
  sourceBookingId: string | null;
}

export interface Invoice {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: InvoiceStatus;
  isDeposit: boolean;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  bookingId: string;
  billToContactId: string;
  billToContact: Contact;
  lineItems: InvoiceLineItem[];
  // isOverdue is derived client-side: status === 'SENT' && dueDate && new Date(dueDate) < new Date()
}

export interface CreateInvoiceInput {
  status?: InvoiceStatus;
  isDeposit?: boolean;
  billToContactId?: string; // defaults to booking's customerId
  lineItems?: CreateLineItemInput[];
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  billToContactId?: string;
}

export interface CreateLineItemInput {
  description: string;
  amount: number;
  order?: number;
}

export interface UpdateLineItemInput {
  description?: string;
  amount?: number;
  order?: number;
}

// ─────────────────────────────────────────
// Songs
// ─────────────────────────────────────────

export interface Song {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  artist: string | null;
  genre: SongGenre;
  active: boolean;
  tags: string[];
}

export interface CatalogueEntry {
  id: string;
  title: string;
  artist?: string;
  genre: string;
}

export interface CatalogueGroup {
  genre: string;
  label: string;
  songs: CatalogueEntry[];
}

export interface CreateSongInput {
  title: string;
  genre: SongGenre;
  artist?: string;
  active?: boolean;
  tags?: string[];
}

export interface UpdateSongInput {
  title?: string;
  genre?: SongGenre;
  artist?: string | null;
  active?: boolean;
  tags?: string[];
}

// ─────────────────────────────────────────
// Package Templates (library)
// ─────────────────────────────────────────

export interface PackageTemplateSlot {
  id: string;
  label: string | null;
  duration: number;
  order: number;
}

export interface PackageTemplate {
  id: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  category: string | null;
  icon: string;
  keyMoments: string[];
  defaultGenreSelection: string[];
  notes: string | null;
  isSystemDefault: boolean;
  enabled: boolean;
  slots: PackageTemplateSlot[];
}

export interface SlotInput {
  id?: string;
  label?: string;
  duration: number;
  order: number;
}

export interface CreatePackageInput {
  label: string;
  icon: string;
  category?: string;
  notes?: string;
  keyMoments?: string[];
  defaultGenreSelection?: string[];
  enabled?: boolean;
  slots?: SlotInput[];
}

export interface UpdatePackageInput {
  label?: string;
  icon?: string;
  category?: string | null;
  notes?: string | null;
  keyMoments?: string[];
  defaultGenreSelection?: string[];
  enabled?: boolean;
  slots?: SlotInput[];
}

// ─────────────────────────────────────────
// Documents
// ─────────────────────────────────────────

export type DocumentType = 'INVOICE' | 'CONTRACT' | 'SONG_LIST' | 'UPLOAD';

export interface Document {
  id: string;
  createdAt: string;
  type: DocumentType;
  url: string;
  invoiceId: string | null;
  contractStatus: string | null;
  name: string | null;
  // Per-document portal-visibility verdict (ADR-0054 / #580) — drives the per-row indicator.
  portalVisibility: PortalVisibilityVerdict;
}

// ─────────────────────────────────────────
// Communications
// ─────────────────────────────────────────

export type CommunicationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface Communication {
  id: string;
  createdAt: string;
  updatedAt: string;
  direction: 'OUTBOUND';
  channel: 'EMAIL';
  status: CommunicationStatus;
  subject: string;
  body: string;
  sentAt: string | null;
  bookingId: string;
  contactId: string;
  contact: Contact;
  templateId: string | null;
  template: Template | null;
  /** Set when an invoice PDF was attached; null for plain emails. */
  document: { id: string; invoiceId: string | null } | null;
}

export interface CreateCommunicationInput {
  contactId: string;
  subject: string;
  body: string;
  templateId?: string;
  sentAt?: string;
}

// ─────────────────────────────────────────
// Templates
// ─────────────────────────────────────────

export type BuiltInTemplateType =
  | 'quote'
  | 'confirmation'
  | 'contract_cover'
  | 'contract_and_deposit_cover'
  | 'deposit_invoice_cover'
  | 'balance_invoice_cover'
  | 'music_form_invite'
  | 'thank_you'
  | 'contract_received'
  | 'deposit_received'
  | 'contract';

export interface Template {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  content: Record<string, unknown>; // Tiptap JSON
  builtInType: BuiltInTemplateType | null;
}

export interface CreateTemplateInput {
  name: string;
  content: Record<string, unknown>;
}

export interface UpdateTemplateInput {
  name?: string;
  content?: Record<string, unknown>;
}

// ─────────────────────────────────────────
// User profile
// ─────────────────────────────────────────

export interface DueDateRule {
  basis: 'bookingDate' | 'bookingCreation';
  offsetDays: number;
}

export interface ChecklistDefaultItem {
  key: string | null;
  label: string;
  completedBy: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';
  // ADR-0057 / #609: `dependsOn` retired from the frontend contract. The create form chooses goals
  // by key; the backend owns step structure and the soft after-clause reads the server catalog.
  autoCompleteRule: Record<string, unknown> | null;
  requiredForStatus: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;
  dueDateRule: DueDateRule | null;
  enabled?: boolean;
  // A custom global-template item carries its user-chosen concern; system defaults
  // resolve theirs from the concern map and leave this unset.
  concern?: string | null;
}

export interface CreateChecklistItemInput {
  label: string;
  requiredForStatus?: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' | null;
  dueDate?: string | null;
  // Tag a custom item to a concern so it appears in that section's control.
  concern?: string | null;
}

export interface InvoiceNumberPreview {
  invoiceNumber: string;
  willReuse: boolean;
}

export type PaddingWidth = 1 | 3 | 4 | 6;

export interface InvoiceNumberFormat {
  prefix: string;
  includeYear: boolean;
  paddingWidth: PaddingWidth;
}

export interface UserPreferences {
  reminderLeadDays: number;
  checklistDefaults: ChecklistDefaultItem[];
  defaultBookingStatus?: 'ENQUIRY' | 'PROVISIONAL' | 'CONFIRMED';
  invoiceNumberFormat?: InvoiceNumberFormat;
  customDressCodeOptions?: string[];
  // Ids of dismissed teaching surfaces (tips + concept cards) — one shared namespace.
  dismissedHints?: string[];
}

export interface UserProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  bankDetails: string | null;
  vatNumber: string | null;
  vatRate: number;
  defaultPaymentTermsDays: number;
  invoiceNumberSequence: number;
  invoiceSequenceYear: number;
  depositPercentage: number | null;
  digestEmailEnabled: boolean;
  songRequestFormEnabled: boolean;
  preferences: Partial<UserPreferences>;
  onboardingCompletedAt: string | null;
}

export type PortalTheme = 'LIGHT_MODERN' | 'LIGHT_ROMANTIC' | 'BOLD_MODERN' | 'BOLD_ROMANTIC';

export interface ClientPortalConfig {
  theme: PortalTheme;
  brandColour: string;
  heroImage: 'piano' | 'stage' | null;
  showContactPhoto: boolean;
  showContactEmail: boolean;
  showContactPhone: boolean;
}

export interface PublicProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
  businessName: string;
  displayName: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  logoUrl: string | null;
  photo: string | null;
  website: string | null;
  socials: Record<string, string> | null;
  clientPortalConfig: ClientPortalConfig;
}

export interface UpdateUserProfileInput {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  bankDetails?: string | null;
  vatNumber?: string | null;
  vatRate?: number;
  defaultPaymentTermsDays?: number;
  depositPercentage?: number;
  digestEmailEnabled?: boolean;
  songRequestFormEnabled?: boolean;
  preferences?: Partial<UserPreferences>;
}

export interface UpdatePublicProfileInput {
  businessName?: string;
  displayName?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  photo?: string | null;
  website?: string | null;
  socials?: Record<string, string> | null;
  clientPortalConfig?: Partial<ClientPortalConfig>;
}

// ─────────────────────────────────────────
// Portal (public, no auth)
// ─────────────────────────────────────────

export interface PortalBookingSet {
  order: number;
  label: string | null;
  startTime: string | null;
  duration: number | null;
  packageId: string | null;
}

export interface PortalBookingFormat {
  id: string;
  label: string;
  icon: string;
  order: number;
}

export interface PortalBooking {
  id: string;
  date: string;
  fee: string | null;
  title: string | null;
  status: BookingStatus;
  customerName: string;
  customerGreetingName: string | null;
  venueName: string | null;
  sets: PortalBookingSet[];
  formats: PortalBookingFormat[];
  contractSignedAt: string | null;
}

export interface PortalPublicProfile {
  businessName: string;
  displayName: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  logoUrl: string | null;
  brandColour: string;
  photo: string | null;
  portalTheme: PortalTheme | null;
  portalHeroImage: string | null;
  showContactPhoto: boolean;
  showContactEmail: boolean;
  showContactPhone: boolean;
}

export interface PortalDocument {
  id: string;
  type: 'CONTRACT' | 'INVOICE' | 'SONG_LIST';
  label: string;
  url: string;
  createdAt: string;
}

export interface MusicFormResponseSong {
  id: string;
  title: string;
  artist: string | null;
  genre: string;
}

export interface MusicFormResponseSpecialRequest {
  key: string;
  song: MusicFormResponseSong | null;
  freeText: string | null;
}

export interface MusicFormResponse {
  selectedSongs: MusicFormResponseSong[];
  specialRequests: MusicFormResponseSpecialRequest[];
  notes: string | null;
  submittedAt: string;
}

export interface PortalData {
  booking: PortalBooking;
  publicProfile: PortalPublicProfile;
  signedContractUrl: string | null;
  documents: PortalDocument[];
  hasMusicForm: boolean;
  hasMusicFormResponse: boolean;
  contractStatus: 'SENT' | 'SIGNED' | null;
  depositInvoiceDueDate: string | null;
}

export interface PortalSong {
  id: string;
  title: string;
  artist: string | null;
  genre: string;
}

export interface PortalSpecialRequest {
  key: string;
  songId?: string;
  freeText?: string;
}

export interface PortalExistingMusicResponse {
  selectedSongIds: string[];
  specialRequests: PortalSpecialRequest[];
  notes: string | null;
}

export interface PortalMusicFormData {
  config: {
    keyMoments: KeyMoment[];
    enabledGenres: string[];
  };
  songs: PortalSong[];
  allSongs: PortalSong[];
  existingResponse: PortalExistingMusicResponse | null;
}

export interface SubmitMusicFormInput {
  selectedSongIds: string[];
  specialRequests: PortalSpecialRequest[];
  notes?: string;
}

export interface PortalContractData {
  content: unknown; // Tiptap JSON
  title: string;
}

// ─────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────

export interface UpcomingGig {
  id: string;
  date: string;
  title: string | null;
  customerName: string;
  venueName: string | null;
  status: BookingStatus;
}

export interface CalendarBooking {
  id: string;
  date: string;
  title: string | null;
  customerName: string;
  status: BookingStatus;
}

export interface DashboardActionItem {
  key: string;
  label: string;
  state: 'outstanding' | 'failed';
}

export interface DashboardAction {
  bookingId: string;
  bookingDate: string;
  bookingTitle: string | null;
  customerName: string;
  venueName: string | null;
  item: DashboardActionItem;
}

export interface DashboardData {
  upcomingGigs: UpcomingGig[];
  actions: DashboardAction[];
  calendarBookings: CalendarBooking[];
}

export interface TravelTimeResponse {
  minutes: number;
  distanceMetres: number;
  calculatedAt: string;
}
