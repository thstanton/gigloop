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
  // Band roster — dep profile (#886, ADR-0072 §4). Shared-with-band, not organiser-private.
  primaryBandRole: string | null;
  instruments: string[];
  travelNotes: string | null;
  equipmentNotes: string | null;
  outfitNotes: string | null;
  availabilityNotes: string | null;
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
  /** Every BookingBandMember row for this contact, removed ones included (#886) — a contact on a
   *  roster and on no bookings still blocks deletion. */
  bandMemberCount: number;
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
  primaryBandRole?: string;
  instruments?: string[];
  travelNotes?: string;
  equipmentNotes?: string;
  outfitNotes?: string;
  availabilityNotes?: string;
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
  primaryBandRole?: string | null;
  instruments?: string[];
  travelNotes?: string | null;
  equipmentNotes?: string | null;
  outfitNotes?: string | null;
  availabilityNotes?: string | null;
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

// A seat in a segment (ADR-0072 §2, #884). A vacancy is `memberId = null`, a first-class thing the
// musician looks at, not an absence — assignment (#885) never creates or destroys a chair row, it
// sets this field. `callTime` is derived server-side from the segment's earliest
// PerformanceSet.startTime; absent (null), not zero, when that segment has no start time.
export interface BookingBandChair {
  id: string;
  role: string;
  order: number;
  packageId: string | null;
  memberId: string | null;
  callTime: string | null;
}

// ADR-0072 §5: ADDED -> INVITED -> CONFIRMED | DECLINED. ADDED -> CONFIRMED is legal — confirming
// on someone's behalf must not fabricate an INVITED that never happened. Declared once in
// lib/constants.ts (BAND_MEMBER_STATUSES) with a compile-time coverage check against this union.
export type BookingBandMemberStatus = 'ADDED' | 'INVITED' | 'CONFIRMED' | 'DECLINED';

// A person on this gig (ADR-0072 §2/§5, #885) — reused across every chair the same contact fills,
// so one member row carries one token, one fee, one confirmation however many segments they play.
// Removed members never reach this shape — the booking response excludes them entirely.
export interface BookingBandMember {
  id: string;
  contactId: string;
  contact: ContactSummary;
  bandPortalToken: string;
  status: BookingBandMemberStatus;
  /** Marks this member as the musician themself (ADR-0072 §3) — optional, does not fill a chair on its own. */
  isSelf: boolean;
  sessionFee: string | null; // Decimal serialises as string over JSON
  invitedAt: string | null;
  respondedAt: string | null;
}

// The band roster (ADR-0072/0073 §6): chairs (seats) and members (people), removed members excluded.
export interface BookingBand {
  chairs: BookingBandChair[];
  members: BookingBandMember[];
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
  /** #533: null = draft (private); an ISO timestamp = published (client-visible on the portal). */
  publishedAt: string | null;
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

// Mirrors BookingResponseDto (apps/api/src/bookings/dto/booking-response.dto.ts), which documents
// GET /bookings/:id. `travelMode`, and the `createdAt`/`updatedAt`/`bookingId` fields on nested
// sets and packages, are declared server-side (BookingPerformanceSetDto / BookingPackageDto) but
// unused here — a narrower projection of the DTO's shape, not an over-fetch.
export interface BookingDetail extends Omit<BookingListItem, 'customer' | 'venue' | 'bookingAgent'> {
  customer: Contact;
  venue: Contact | null;
  bookingAgent: Contact | null;
  sets: PerformanceSet[];
  packages: BookingPackageSummary[];
  activeContract: Contract | null;
  portalToken: string;
  hasMusicFormConfig: boolean;
  hasMusicFormResponse: boolean;
  seriesId: string | null;
  // The API selects only { id, label } for the series (bookings.repository.ts `bookingDetailSelect`).
  // `customerId` was declared here but never sent — anything reading it got `undefined` (#786).
  series: { id: string; label: string } | null;
  logistics: Record<string, BookingLogisticsEntry> | null;
  notes: string | null;
  // Per-concern portal-visibility verdicts, computed by the single backend authority (ADR-0054).
  // A null verdict means the concern is not a live portal concern (no contract yet / music form off).
  portalVisibility: BookingPortalVisibility;
  band: BookingBand;
}

// Portal-visibility verdict (ADR-0054). The API returns a stable ReasonCode, never English —
// the reason → copy map lives frontend-side in lib/constants.ts. The full union is defined now;
// slice 1 (#578) only emits `until_sent`/`voided` (contract) — `not_shared`/`cancelled` arrive
// with the leak fixes (#579).
export type PortalVisibilityReason =
  | 'until_sent'
  | 'until_published'
  | 'voided'
  | 'not_shared'
  | 'cancelled'
  | 'other_booking';

export interface PortalVisibilityVerdict {
  visible: boolean;
  reason?: PortalVisibilityReason;
}

export interface BookingPortalVisibility {
  contract: PortalVisibilityVerdict | null;
  musicForm: PortalVisibilityVerdict | null;
}

// The narrower verdict a *document* carries (#750). Mirrors the API's
// DOCUMENT_PORTAL_VISIBILITY_REASONS (apps/api/src/portal/portal-visibility.ts): a document is
// never draft-then-published — that gate is the booking-level music-form concern (#533) — so the
// API can never send `until_published` on a document, and web code must not branch on it.
// The booking-level union above deliberately stays at five members; so does
// PORTAL_VISIBILITY_REASON_COPY in lib/constants.ts, which serves both surfaces.
export type DocumentPortalVisibilityReason = Exclude<PortalVisibilityReason, 'until_published'>;

export interface DocumentPortalVisibilityVerdict {
  visible: boolean;
  reason?: DocumentPortalVisibilityReason;
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
  // The date the payment was received (ADR-0068), chosen by the musician — not the tap moment.
  paidAt: string | null;
  // Optional payment reference recorded alongside paidAt (e.g. a bank reference); null when unset.
  paymentReference: string | null;
  // One polymorphic Invoice entity (ADR-0063): a booking invoice has bookingId set and seriesId null;
  // a series invoice has seriesId set and bookingId null. Both FKs are nullable on the wire.
  bookingId: string | null;
  seriesId: string | null;
  billToContactId: string;
  billToContact: Contact;
  lineItems: InvoiceLineItem[];
}

// Response of POST /series/:id/invoices (#850). The invoice still bills every fee-less member a
// £0.00 line unconditionally — this count is a heads-up so it never reaches a client unnoticed.
export interface CreateSeriesInvoiceResponse {
  invoice: Invoice;
  feelessMemberCount: number;
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
  category: EventType | null;
  icon: string;
  keyMoments: string[];
  defaultGenreSelection: string[];
  notes: string | null;
  isSystemDefault: boolean;
  enabled: boolean;
  // Band members v1 (#879, ADR-0072 §3): applying this package auto-applies this lineup, if set.
  defaultLineupTemplateId: string | null;
  slots: PackageTemplateSlot[];
}

// A starter template from GET /packages/catalogue — the system defaults, served read-only (never
// auto-added to the library). Onboarding Step 3 bases a new template on one of these. No id/timestamps
// because it isn't persisted; slots have no ids.
export interface PackageCatalogueSlot {
  label: string;
  duration: number;
  order: number;
}

export interface PackageCatalogueItem {
  id: string;
  label: string;
  category: EventType | null;
  icon: string;
  keyMoments: string[];
  defaultGenreSelection: string[];
  slots: PackageCatalogueSlot[];
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
  category?: EventType;
  notes?: string;
  keyMoments?: string[];
  defaultGenreSelection?: string[];
  enabled?: boolean;
  defaultLineupTemplateId?: string;
  slots?: SlotInput[];
}

export interface UpdatePackageInput {
  label?: string;
  icon?: string;
  category?: EventType | null;
  notes?: string | null;
  keyMoments?: string[];
  defaultGenreSelection?: string[];
  enabled?: boolean;
  defaultLineupTemplateId?: string | null;
  slots?: SlotInput[];
}

// ─────────────────────────────────────────
// Lineup Templates (band members v1, #879, ADR-0072)
// ─────────────────────────────────────────

export interface LineupTemplateSlot {
  id: string;
  role: string;
  order: number;
}

export interface LineupTemplate {
  id: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  slots: LineupTemplateSlot[];
}

export interface LineupSlotInput {
  id?: string;
  role: string;
  order: number;
}

export interface CreateLineupInput {
  label: string;
  slots?: LineupSlotInput[];
}

export interface UpdateLineupInput {
  label?: string;
  slots?: LineupSlotInput[];
}

// ─────────────────────────────────────────
// Documents
// ─────────────────────────────────────────

export type DocumentType = 'INVOICE' | 'CONTRACT' | 'SONG_LIST' | 'UPLOAD';

export interface Document {
  id: string;
  createdAt: string;
  type: DocumentType;
  // Access-controlled app route (e.g. /documents/:id/download), NOT a public URL.
  // Open via openDocument() from lib/api — it fetches this with auth to resolve
  // the real storage URL, then navigates (ADR-0059 / #654).
  url: string;
  invoiceId: string | null;
  contractStatus: string | null;
  name: string | null;
  // True for a BookingSeries invoice document — the one Document with no owning booking, listed
  // on every member booking's card because it covers all of them (#848, CONTEXT.md → "The one
  // Document with no Booking"). Never true for a document this booking actually owns.
  isSeriesInvoice: boolean;
  // Per-document portal-visibility verdict (ADR-0054 / #580) — drives the per-row indicator.
  // Narrowed to the reasons a document can actually carry (#750).
  portalVisibility: DocumentPortalVisibilityVerdict;
}

/**
 * The stored PDF backing an issued series invoice (#830).
 *
 * Deliberately narrower than `Document`: it carries no `portalVisibility`, because that verdict
 * is a *booking* portal concern (ADR-0054) and a series invoice belongs to no single booking.
 * `url` is the same access-controlled app route — open it via `openDocument()`.
 */
export interface SeriesInvoiceDocument {
  id: string;
  createdAt: string;
  url: string;
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
  // Polymorphic ownership (ADR-0080): exactly one of bookingId/seriesId is set.
  bookingId: string | null;
  seriesId: string | null;
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
  | 'series_invoice_cover'
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

// A step of a multi-step system default goal (ADR-0057). Mirrors the API's ChecklistDefaultStep
// (checklist-defaults.ts) minus the runtime fields (`id`, `order`, `state`, `completedAt`) that only
// exist on a materialised booking step. Carried on the `/me` defaults so the Settings configurator
// can preview a goal's steps read-only (#620/#718) without a separate fetch — never written back.
export interface ChecklistDefaultStep {
  key: string;
  label: string;
  kind: 'MILESTONE' | 'PRECONDITION' | 'FOLLOWUP';
  completeMode: 'ACTION' | 'AWAITED';
  completedBy: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';
  autoCompleteRule: Record<string, unknown> | null;
  dueDateRule?: DueDateRule | null;
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
  // Ordered steps of a multi-step goal (ADR-0057), present on system defaults for the read-only
  // Settings preview (#620/#718). Absent for an atomic goal and for custom items. Preview-only —
  // the save contract never sends steps back.
  steps?: ChecklistDefaultStep[];
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
  // Access-controlled app route (/api/booking/:token/documents/:id), NOT a public
  // URL. Usable directly as an <a href> — the portalToken in the path is the auth
  // and the endpoint 302s to storage after re-checking visibility (ADR-0059 / #655).
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
  // Access-controlled app route (/api/booking/:token/signed-contract), NOT a public
  // URL — same contract as PortalDocument.url (ADR-0059 / #655).
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

// ─────────────────────────────────────────
// Search (command palette, ADR-0067)
// ─────────────────────────────────────────

export interface BookingSearchResult {
  type: 'booking';
  id: string;
  url: string;
  title: string;
  subtitle: string | null;
  status: BookingStatus;
  date: string;
  eventType: EventType;
}

export interface ContactSearchResult {
  type: 'contact';
  id: string;
  url: string;
  title: string;
  subtitle: string | null;
  bookingCount: number;
}

// Discriminated on `type` — grouped bookings-then-contacts, top-N per type, no pagination
// (ADR-0067 §3/§5). A future searchable entity is a new `type` variant, not a shape change.
export type SearchResult = BookingSearchResult | ContactSearchResult;
