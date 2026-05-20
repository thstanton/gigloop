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

**Status lifecycle:** `ENQUIRY → CONFIRMED → DEPOSIT_PAID → COMPLETED → INVOICED → SETTLED`
Status transitions are free — not enforced by the API.

**eventType:** `WEDDING | CORPORATE | PRIVATE | RESIDENCY | OTHER`

**Key fields:** status, eventType, date, title (optional), fee (agreed headline amount), notes (optional), customerId (required FK), venueId (optional FK), referrerId (optional FK)

### Contact
Role-agnostic. Role is determined by which FK on a Booking references it (customer / venue / referrer). Cannot be deleted if referenced by any Booking in any role.

**Fields:** name, email, phone, address, notes, parkingInfo, accessInfo, equipmentAvailable (venue extras), website, commissionArrangement (referrer extras) — all optional except name.

### Song
Per-user repertoire entry. Fields: title, artist (optional), genre (enum: `Contemporary | Classical | Jazz | Film, TV and Musicals | Bollywood | Christmas`), active (boolean), tags (string array). Seeded at onboarding via opt-in from a static catalogue — not a shared global table.

### Set
An ordered performance slot within a Booking. Forms the schedule in the contract.

**Fields:** order (integer), duration (minutes), startTime (optional), label (optional — e.g. "Ceremony")

### Invoice
A financial document for a Booking. A Booking may have multiple Invoices (e.g. deposit + balance, or single). Addressed to a Contact (`billToContactId` — defaults to customer, overridable).

**Status:** `DRAFT | SENT | PAID`. Overdue is derived (sent + past due date), not stored.

**Fields:** status, issueDate, dueDate (optional), billToContactId, line items

### InvoiceLineItem
Freeform: description (text) + amount (decimal). No fixed categories.

### Template
Tiptap JSON content block. Decoupled from rendering — rendered as email HTML or contract PDF by the caller. Users can create custom templates.

**Built-in types:** `quote | confirmation | contract_cover | invoice_cover | music_form_invite | thank_you | contract`

**Variables:** flat named substitutions pre-computed by the API (e.g. `{{customerName}}`, `{{bookingDate}}`, `{{venueName}}`, `{{bookingFee}}`, `{{setsSchedule}}`, `{{portalLink}}`, `{{invoiceTotal}}`).

### Communication
Log entry for a communication on a Booking. Direction (`OUTBOUND` for MVP) and channel (`EMAIL`) fields keep the model open for inbound email ingestion post-MVP.

### Document
A generated PDF (Contract or Invoice) stored in Cloudflare R2, linked to a Booking.

### UserProfile
One per userId. Business details for invoices, contracts, and the portal.

**Fields:** businessName, address, email, phone, website, photo (R2 URL), logo (R2 URL), socials (JSON), bankDetails, vatNumber (optional), defaultPaymentTermsDays, invoiceNumberSequence.

## MVP Scope

### In scope
- Contacts (CRUD)
- Bookings (CRUD, status management, Sets)
- Invoices + line items (CRUD, PDF generation)
- Contract PDF generation from user-editable Template
- Email templates (built-in + custom) with variable substitution, sent via Resend
- Client portal (`/booking/:token`): view booking/sets, submit music preferences (MusicForm), download contract PDF — musician-branded with selectable theme
- Song library (CRUD, genre/tag management, per-user)
- Onboarding flow: opt-in song selection from seed catalogue
- UserProfile / business settings
- Daily digest notification email (upcoming bookings + inferred required actions)

### Post-MVP
- Dashboard analytics
- Email ingestion (automated enquiry capture, possibly AI-assisted)
- Full bidirectional comms log

## Out of Scope for MVP
- OAuth / social login
- Stripe payment integration
- Email account integration
- Sheet music upload
- Automated reminders
