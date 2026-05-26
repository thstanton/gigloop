// Wire-format types for all API endpoints.
// Kept in sync with apps/api/src/**/dto — update here whenever a DTO changes.
// Prisma-level types (Decimal, DateTime) appear here as their JSON equivalents
// (string). Enums are plain union types — no dependency on @prisma/client.

// ─────────────────────────────────────────
// Enums
// ─────────────────────────────────────────

export type BookingStatus =
  | 'ENQUIRY'
  | 'CONFIRMED'
  | 'INVOICED'
  | 'SETTLED'
  | 'COMPLETED'
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

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID';

// ─────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────

export interface Contact {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  parkingInfo: string | null;
  accessInfo: string | null;
  equipmentAvailable: string | null;
  website: string | null;
  commissionArrangement: string | null;
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
  referrerBookings: BookingRef[];
}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  parkingInfo?: string;
  accessInfo?: string;
  equipmentAvailable?: string;
  website?: string;
  commissionArrangement?: string;
}

export interface UpdateContactInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  parkingInfo?: string | null;
  accessInfo?: string | null;
  equipmentAvailable?: string | null;
  website?: string | null;
  commissionArrangement?: string | null;
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
  performanceFormatId: string | null;
}

export interface BookingPerformanceFormatSummary {
  id: string;
  order: number;
  performanceFormatId: string;
  performanceFormat: {
    id: string;
    label: string;
    icon: string;
  };
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

export interface BookingListItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: BookingStatus;
  eventType: EventType;
  date: string;
  title: string | null;
  fee: string | null; // Decimal serialises as string over JSON
  notes: string | null;
  customerId: string;
  customer: ContactSummary;
  venueId: string | null;
  venue: ContactSummary | null;
  referrerId: string | null;
  referrer: ContactSummary | null;
}

export interface BookingDetail extends Omit<BookingListItem, 'customer' | 'venue' | 'referrer'> {
  customer: Contact;
  venue: Contact | null;
  referrer: Contact | null;
  sets: PerformanceSet[];
  performanceFormats: BookingPerformanceFormatSummary[];
  contractSignedAt: string | null;
  depositReceivedAt: string | null;
  depositTrackingMode: string | null;
  portalToken: string;
  hasMusicFormConfig: boolean;
  hasMusicFormResponse: boolean;
}

export interface CreateSetInput {
  order: number;
  duration: number;
  startTime?: string;
  label?: string;
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
  referrerId?: string;
  formatIds?: string[];
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
  referrerId?: string | null;
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
// Performance Formats
// ─────────────────────────────────────────

export interface PerformanceFormatSlot {
  id: string;
  label: string | null;
  duration: number;
  order: number;
}

export interface PerformanceFormat {
  id: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  category: string | null;
  icon: string;
  keyMoments: string[];
  defaultGenreSelection: string[];
  notes: string | null;
  slots: PerformanceFormatSlot[];
}

// ─────────────────────────────────────────
// Documents
// ─────────────────────────────────────────

export type DocumentType = 'INVOICE' | 'CONTRACT' | 'SONG_LIST';

export interface Document {
  id: string;
  createdAt: string;
  type: DocumentType;
  url: string;
  invoiceId: string | null;
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

export interface UserProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
  address: string | null;
  bankDetails: string | null;
  vatNumber: string | null;
  defaultPaymentTermsDays: number;
  invoiceNumberSequence: number;
  invoiceSequenceYear: number;
  depositTrackingMode: string;
  depositPercentage: number | null;
  digestEmailEnabled: boolean;
  songRequestFormEnabled: boolean;
  quoteReminderDays: number | null;
  contractReminderDays: number | null;
  depositInvoiceReminderDays: number | null;
  balanceInvoiceReminderDays: number | null;
  musicFormReminderDays: number | null;
  thankYouReminderDays: number | null;
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
  brandColour: string | null;
  photo: string | null;
  website: string | null;
  socials: Record<string, string> | null;
  portalTheme: string;
}

export interface UpdateUserProfileInput {
  address?: string;
  bankDetails?: string | null;
  vatNumber?: string;
  defaultPaymentTermsDays?: number;
  depositTrackingMode?: string;
  depositPercentage?: number;
  digestEmailEnabled?: boolean;
  songRequestFormEnabled?: boolean;
  quoteReminderDays?: number | null;
  contractReminderDays?: number | null;
  depositInvoiceReminderDays?: number | null;
  balanceInvoiceReminderDays?: number | null;
  musicFormReminderDays?: number | null;
  thankYouReminderDays?: number | null;
}

export type PortalTheme = 'LIGHT_MODERN' | 'LIGHT_ROMANTIC' | 'BOLD_MODERN' | 'BOLD_ROMANTIC';

export interface UpdatePublicProfileInput {
  businessName?: string;
  displayName?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  brandColour?: string;
  photo?: string | null;
  website?: string | null;
  socials?: Record<string, string> | null;
  portalTheme?: PortalTheme;
}

// ─────────────────────────────────────────
// Portal (public, no auth)
// ─────────────────────────────────────────

export interface PortalBookingSet {
  order: number;
  label: string | null;
  startTime: string | null;
  duration: number | null;
}

export interface PortalBooking {
  id: string;
  date: string;
  fee: string | null;
  title: string | null;
  status: BookingStatus;
  customerName: string;
  venueName: string | null;
  sets: PortalBookingSet[];
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
