# CRM for Musicians — SPEC

## Before Every Session
- Read SPEC.md before writing any code
- Confirm you understand the hard rules below before proceeding
- If anything in the task contradicts SPEC.md, flag it rather 
  than resolving it yourself

## Code Conventions
- TypeScript strict mode in both apps
- NestJS: one module per feature (contacts, bookings, songs, etc.)
- All API responses use a consistent shape — ask before deviating
- No any types without a comment explaining why
- Errors are handled at the controller level using NestJS 
  built-in HttpException classes

## Package Discipline
- Do not install new npm packages without asking first
- Do not add packages to solve problems that can be solved with 
  what's already installed

## Session Behaviour
- Build only what the current session specifies
- Do not begin the next feature unprompted
- When the session task is complete, stop and summarise:
  - What was built
  - Any decisions made that weren't in the spec
  - Anything that should be reviewed before the next session
- Do not run database migrations without confirming first

## Stack
- Frontend: React + Vite + React Router v7
- Backend: NestJS (TypeScript)
- ORM: Prisma
- Database: Neon (serverless Postgres)
- Auth: Clerk
- File storage: Cloudflare R2
- Email: Resend
- PDF: @react-pdf/renderer
- Monorepo: npm workspaces

## Repo Structure
apps/
  web/    ← React/Vite frontend
  api/    ← NestJS backend
SPEC.md

## Hard Rules — Never Violate
- Never implement custom auth. Clerk handles all authentication.
- All Prisma models include: id (UUID), userId (String), createdAt, updatedAt
- All API endpoints extract userId from the Clerk JWT via AuthGuard
  and filter all queries by that userId. No endpoint returns cross-tenant data.
- Primary keys are UUIDs everywhere. Never use auto-increment integers.
- File uploads go to Cloudflare R2. Never write uploads to the local filesystem.
- Portal routes (/booking/:token) validate the booking's portalToken.
  They do not use Clerk auth.
- PDF generation uses @react-pdf/renderer, executed in the API and 
  streamed to the client.
- Communication templates are stored as Tiptap JSON. 
  Rendered to HTML at send time with variables substituted.
- Deleting a Contact that has associated Bookings must be blocked 
  at the API level with a clear error message.

## Multi-Tenancy
Every database query must be scoped to the authenticated userId.
This is enforced by a global AuthGuard in NestJS applied to all
routes except portal routes and health checks.

## Entity Overview

### Booking
Central entity. Represents a performance engagement (no separate "Gig" concept).

**Status lifecycle:** `ENQUIRY → CONFIRMED → INVOICED → SETTLED → COMPLETED`; `CANCELLED` is available at any stage.
Status transitions are not enforced by the API — a Booking can move freely between any statuses. CANCELLED bookings are excluded from all list queries; they can be retrieved by passing `status=CANCELLED` explicitly.

**eventType:** `WEDDING | CORPORATE | PRIVATE | RESIDENCY | OTHER`

**Pre-confirmation tracking:** Two nullable timestamp fields — `contractSignedAt` and `depositReceivedAt` — record when each arrived. `contractSignedAt` is always set manually. `depositReceivedAt` behaviour is controlled by `depositTrackingMode`:
- `INVOICE` — automatically set when the deposit Invoice is marked Paid
- `MANUAL` — set directly by the musician on the Booking

Per-booking `depositTrackingMode` overrides `UserProfile.depositTrackingMode`; `null` means inherit from UserProfile. Neither triggers automatic status transitions.

**Key fields:** status, eventType, date, title (optional), fee (agreed headline amount), notes (optional), portalToken (unique UUID — used by the client portal), contractSignedAt, depositReceivedAt, depositTrackingMode, customerId (required FK), venueId (optional FK), referrerId (optional FK)

### Contact
Role-agnostic — no type field. Role is determined by which FK on a Booking references it (customer / venue / referrer). Cannot be deleted if referenced by any Booking in any role.

**Fields:** name, email, phone, address, notes, parkingInfo, accessInfo, equipmentAvailable (venue extras), website, commissionArrangement (referrer extras) — all optional except name.

### PerformanceSet
An ordered performance slot within a Booking. Multiple sets form the running order and constitute the performance schedule in the contract. Referenced as "Set" in user-facing contexts.

**Fields:** order (integer), duration (minutes), startTime (optional), label (optional — e.g. "Ceremony")

### Invoice
A financial document for a Booking. A Booking may have multiple Invoices (e.g. deposit + balance, or single). Addressed to a Contact (`billToContactId` — defaults to customer, overridable).

**Status:** `DRAFT | SENT | PAID`. Overdue is derived (Sent + past due date), not stored.

**isDeposit:** Boolean flag (default false). At most one deposit invoice per Booking. When `isDeposit` is true and the invoice is marked Paid, `Booking.depositReceivedAt` is automatically set if `depositTrackingMode` resolves to `INVOICE`.

**Sending:** Two ways to move to `SENT`: (1) **Send** — emails the invoice PDF via Resend using the `invoice_cover` template and atomically marks Sent; (2) **Mark as sent** — marks Sent without sending an email.

**Fields:** status, isDeposit, issueDate, dueDate (optional), billToContactId, line items

### InvoiceLineItem
Freeform: description (text) + amount (decimal) + order (integer). No fixed categories.

### Template
Tiptap JSON content block. Decoupled from rendering — rendered as email HTML or contract PDF by the caller. Users can create custom templates.

**Fields:** name, content (Tiptap JSON), builtInType (optional enum — only set for system-provided templates)

**Built-in types:** `quote | confirmation | contract_cover | contract_and_deposit_cover | deposit_invoice_cover | balance_invoice_cover | music_form_invite | thank_you | contract`
- `contract_cover` — email body when sending only the contract portal link
- `contract_and_deposit_cover` — email body when sending the contract portal link + deposit invoice PDF (the common case for new bookings)
- `deposit_invoice_cover` — email body when sending the deposit invoice standalone
- `balance_invoice_cover` — email body when sending the balance invoice

**Variables:** flat named substitutions pre-computed by the API — `{{customerName}}`, `{{bookingDate}}`, `{{venueName}}`, `{{bookingFee}}`, `{{setsSchedule}}`, `{{musicianName}}`, `{{musicianEmail}}`, `{{portalLink}}`, `{{invoiceTotal}}`, `{{invoiceDueDate}}`.

### Communication
Log entry for a communication on a Booking. For MVP: outbound emails only. Modelled generically to accommodate inbound messages (email ingestion) post-MVP without schema changes.

**Fields:** direction (`OUTBOUND` — MVP only), channel (`EMAIL`), bookingId, contactId, sentAt, subject, body (rendered HTML), templateId (FK — all outbound emails in MVP are template-based)

### Document
A generated PDF (Contract or Invoice) stored in Cloudflare R2, linked to a Booking. Two types: `CONTRACT` and `INVOICE`. The Contract PDF is generated from a user-editable template. The client signs it via the Portal — a drawn or typed signature is captured, embedded into a regenerated PDF, and the signed version replaces the original in R2.

**Fields:** type (`CONTRACT | INVOICE`), storageKey (R2 object key), bookingId, invoiceId (null for CONTRACT documents)

### Song
Per-user repertoire entry. Fields: title, artist (optional), genre (enum: `CONTEMPORARY | CLASSICAL | JAZZ | FILM_TV_MUSICALS | BOLLYWOOD | CHRISTMAS`), active (boolean — hides without deleting), tags (string array). Seeded at onboarding via opt-in from a static catalogue — not a shared global table.

### MusicFormConfig
Per-booking configuration for the client-facing music preference form. Set by the musician when sending the `music_form_invite`. One-to-one with Booking — not all bookings have one (e.g. a hotel residency would not).

**Fields:** enabledGenres (array of Song genres), keyMoments (array of label strings — e.g. "Processional", "1st Signing Register"). Defaults to the wedding set for `WEDDING` eventType, empty for others.

### MusicFormResponse
The client's submitted music preferences, stored on a Booking (zero-to-one). Re-submitting replaces the previous response.

**Fields:** selectedSongIds (array of Song IDs chosen from the general list), specialRequests (JSON — array of `{ key, songId?, freeText? }`, one entry per key moment), notes (freeform), submittedAt

### PublicProfile
Public, portal-visible half of the musician's profile (one per userId). Safe to return to unauthenticated portal clients — contains no sensitive data.

**Fields:** businessName, displayName, bio, email, phone, logoUrl (R2 URL), brandColour (hex), photo (R2 URL), website, socials (JSON — platform → URL), portalTheme

**`portalTheme` enum:** `LIGHT_MODERN | LIGHT_ROMANTIC | BOLD_MODERN | BOLD_ROMANTIC`. Each preset bundles a layout style (Light = clean white with contained photo; Bold = full-bleed photo hero) with a font pairing (Modern = DM Sans; Romantic = Cormorant Garamond/Lato). Default: `LIGHT_MODERN`.

### UserProfile
Private, authenticated-only half of the musician's profile (one per userId). Never returned to portal clients.

**Fields:** address, bankDetails (encrypted at rest), vatNumber, defaultPaymentTermsDays, invoiceNumberSequence, invoiceSequenceYear, depositTrackingMode, digestEmailEnabled, songRequestFormEnabled, quoteReminderDays, contractReminderDays, depositInvoiceReminderDays, balanceInvoiceReminderDays, musicFormReminderDays, thankYouReminderDays

**Invoice numbering:** format `INV-{year}-{NNN}` (e.g. `INV-2025-001`). `invoiceNumberSequence` is a per-year counter; `invoiceSequenceYear` records the year it was last reset. Both reset each January.

**Digest & reminder preferences:** `digestEmailEnabled` (default true) and `songRequestFormEnabled` (default true) are global feature toggles. The `*ReminderDays` fields are nullable integers — `null` means the reminder is disabled; a positive value is days before the booking date (except `thankYouReminderDays`, which is days after). These are global defaults; per-booking overrides are deferred to P3.

## MVP Scope

### In scope
- Contacts (CRUD)
- Bookings (CRUD, status management, PerformanceSets, pre-confirmation tracking)
- Invoices + line items (CRUD, deposit tracking, PDF generation)
- Contract PDF generation from user-editable Template
- Contract signing via Portal (drawn/typed signature embedded into regenerated PDF, stored in R2)
- Email templates (built-in + custom) with variable substitution, sent via Resend
- Communication log (outbound emails)
- Document storage in Cloudflare R2 (contracts and invoices)
- Client portal (`/booking/:token`): booking summary, contract signing, signed contract download, music preference form (when MusicFormConfig is present) — musician-branded with selectable theme
- Song library (CRUD, genre/tag management, per-user)
- Music form config (per-booking genre and key moment configuration)
- Onboarding flow: opt-in song selection from seed catalogue
- PublicProfile (portal branding) + UserProfile (private business settings)
- Daily digest notification email (upcoming bookings + inferred required actions)

### Post-MVP
- Dashboard analytics
- Email ingestion (automated enquiry capture, possibly AI-assisted) — will surface the Enquiry status fully
- Full bidirectional comms log (inbound email)
- Post-gig checklist

## Out of Scope for MVP
- OAuth / social login
- Stripe payment integration
- Email account integration
- Sheet music upload
- Automated reminders
- Custom genres
- Embeddable website enquiry form
