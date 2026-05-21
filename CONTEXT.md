# GigMan — Domain Glossary

A CRM for musicians. The central workflow is managing Bookings with Contacts.

---

## Terms

### Booking
The central entity. Represents a performance engagement — confirmed or in-progress. Connects a Contact to a body of work (sets, song list, documents, communications).  There is no separate concept of "Gig"; Booking covers the full lifecycle of a performance engagement.

**Lifecycle (ordered):** `Enquiry → Confirmed → Invoiced → Settled → Completed`
- *Enquiry*: initial interest, not yet confirmed. In current practice, musicians tend to create bookings after the client has agreed to proceed, so this status sees limited use in MVP. Its full value arrives with the P2 email ingestion feature, which will create Enquiry-stage bookings automatically from inbound emails. An embeddable website enquiry form is explicitly out of scope — a previous implementation in Giggio was removed due to poor UX and inability to match the musician's site styling. P2 strategy is email ingestion, not a web widget.
- *Confirmed*: engagement is agreed; contract signed and deposit received (musician moves manually once both pre-conditions are met).
- *Invoiced*: the final balance invoice has been sent; typically occurs before the performance date.
- *Settled*: the balance invoice has been paid in full; typically also before the performance date.
- *Completed*: post-gig admin is done. For MVP this is a simple manual flag set by the musician. A configurable per-user post-gig checklist is a future feature.

**Pre-confirmation tracking:** two nullable timestamp fields — `contractSignedAt` and `depositReceivedAt` — record when each arrived. `contractSignedAt` is always set manually. `depositReceivedAt` behaviour is controlled by `depositTrackingMode`:
- `INVOICE` — automatically set when the deposit [[Invoice]] is marked Paid.
- `MANUAL` — set directly by the musician on the Booking.

`UserProfile.depositTrackingMode` is the global default. `Booking.depositTrackingMode` is a nullable per-booking override; `null` means inherit from UserProfile. Neither triggers automatic status transitions — the musician still moves status to `Confirmed` manually.

Status transitions are not enforced by the API — a Booking can move freely between any statuses.

**Top-level fields:**
- **status**: see lifecycle above
- **date**: the date (and optionally time) of the performance
- **title** (optional): human-readable label; useful when the booking is for a named event (e.g. a festival) not easily derived from the customer name
- **fee**: the agreed total amount (Option A — independent of invoice line items; represents what was verbally agreed, used in the contract)
- **notes** (optional): freeform internal notes for the musician
- **eventType**: `WEDDING | CORPORATE | PRIVATE | RESIDENCY | OTHER` — controls portal music form sections and default template behaviour
- **customerId** (required FK → Contact)
- **venueId** (optional FK → Contact): venue address/info lives on the Contact record, not duplicated
- **referrerId** (optional FK → Contact)
- **sets**: ordered list of [[Set]] entities
- **songList** (optional): song requirements for the booking — deferred to [[song-library]] feature

### Contact
A person or organisation the musician does business with. Role-agnostic — the role is determined by which FK on the Booking references it. A Contact with associated Bookings (in any role) cannot be deleted.

**Fields (all optional except name):**
- name (required)
- email, phone, address (freeform text), notes
- *Venue extras:* parkingInfo, accessInfo, equipmentAvailable
- *Referrer extras:* website, commissionArrangement (freeform text)

All fields live on the Contact table as nullable columns — no sub-type tables. A Contact can serve as both a venue and a referrer on different Bookings; the extra fields are always available regardless of role.

### Set
A scheduled performance slot within a Booking. Multiple Sets form the running order for the day and constitute the performance schedule in the contract. Fields:
- **duration** (required): length in minutes (e.g. 45)
- **startTime** (optional): the time the set begins (e.g. 14:00)
- **label** (optional): occasion name (e.g. "Ceremony", "Drinks Reception", "Dinner")
- **order** (required): integer used to preserve sequence when start times are absent

Song requirements within a Set (must-haves, don't-plays, special roles) are deferred to the Song Library feature.

### Invoice
A financial document issued to a Contact for a Booking. A Booking can have multiple Invoices (e.g. a deposit invoice followed by a balance invoice, or a single full invoice — the musician decides). Has many [[InvoiceLineItem]]s.

**Status:** `Draft | Sent | Paid` (stored). *Overdue* is derived — not a stored state — inferred when status is `Sent`, a due date is set, and that date has passed.

Two ways to move to `Sent`: (1) **Send** — app emails the invoice PDF via Resend using the `invoice_cover` template and atomically marks it Sent; (2) **Mark as sent** — marks it Sent without sending an email, for cases where the invoice was communicated outside the app.

**Fields include:** issueDate, dueDate (optional), status, isDeposit (boolean, default false — at most one deposit invoice per booking), and a reference to which Contact it is addressed to (defaults to the Booking's customer but may differ). When `isDeposit` is true and the invoice is marked Paid, `Booking.depositReceivedAt` is automatically set (if `depositTrackingMode` resolves to `INVOICE`).

### InvoiceLineItem
A freeform line on an [[Invoice]]: description (text) + amount (decimal). No fixed categories.

### Template
A reusable content block stored as Tiptap JSON. Decoupled from rendering — the caller decides whether to render it as email HTML (via Resend) or as a PDF (via @react-pdf/renderer). Users can create custom templates alongside the built-in ones.

**Fields:** name, content (Tiptap JSON), builtInType (optional enum — only set for system-provided templates)

**Built-in types:** `quote | confirmation | contract_cover | contract_and_invoice_cover | invoice_cover | music_form_invite | thank_you | contract`

- `contract_cover` — email body when sending only the contract portal link
- `contract_and_invoice_cover` — email body when sending the contract portal link + a deposit invoice PDF attachment (the common case for new bookings)
- `invoice_cover` — email body when sending a standalone invoice PDF

The template type determines what gets attached — the musician picks the template, not individual attachments.

The `quote` template is optional — in current practice quotes are sent externally before a booking is created in the app. It becomes more useful once P2 email ingestion allows bookings to be created at the enquiry stage.

**Variable substitution:** flat named variables — the API pre-computes a flat context object before rendering. No dot-notation paths or loops in template content. Multi-value data (e.g. sets schedule) is pre-rendered into a single substitution variable (e.g. `{{setsSchedule}}`).

Expected variables include: `{{customerName}}`, `{{bookingDate}}`, `{{venueName}}`, `{{bookingFee}}`, `{{setsSchedule}}`, `{{musicianName}}`, `{{musicianEmail}}`, `{{portalLink}}`, `{{invoiceTotal}}`, `{{invoiceDueDate}}`.

### Communication
A log entry for a communication associated with a Booking. For MVP: outbound only (sent emails). Modelled generically to accommodate inbound messages (email ingestion) in a future release without schema changes.

**Fields:** direction (`OUTBOUND` — MVP only), channel (`EMAIL`), contactId, sentAt, subject, body (rendered HTML), templateId (FK — all outbound emails in MVP are template-based; freeform email is not supported).

### PublicProfile
The public, portal-visible half of the musician's settings (one per `userId`). Safe to return to unauthenticated portal clients — contains no sensitive data. See ADR-0002.

**Fields:** businessName, displayName, bio, email, phone, logoUrl (R2 URL), brandColour (hex), photo (R2 URL), website, socials (JSON — platform → URL), portalTheme.

**`portalTheme` enum:** `BOLD_ROMANTIC | BOLD_MODERN | LIGHT_ROMANTIC | LIGHT_MODERN`. Each preset bundles a layout style (Bold = full-bleed photo hero; Light = clean white with contained photo) with a font pairing (Romantic = Cormorant Garamond/Lato; Modern = DM Sans). Four themes cover the full matrix.

The client-facing [[Portal]] is musician-branded: displays the musician's logo, photo, name, and chosen theme. It is not GigMan-branded. Design reference: WithJoy — photo-forward, elegant typography, premium and personal in feel, mobile-first.

### UserProfile
The private, authenticated-only half of the musician's settings (one per `userId`). Never returned to portal clients. See ADR-0002.

**Fields:** address, bankDetails (encrypted at rest — see ADR-0003), vatNumber, defaultPaymentTermsDays, invoiceNumberSequence, invoiceSequenceYear, depositTrackingMode, digestEmailEnabled, songRequestFormEnabled, quoteReminderDays, contractReminderDays, depositInvoiceReminderDays, balanceInvoiceReminderDays, musicFormReminderDays, thankYouReminderDays.

**Invoice numbering:** format `INV-{year}-{NNN}` (e.g. `INV-2025-001`). `invoiceNumberSequence` is a per-year counter; `invoiceSequenceYear` records the year it was last reset. Both reset each January. Subject to revision.

**Reminder offsets:** the `*ReminderDays` fields are global defaults controlling when each [[BookingChecklist]] action appears in the [[DigestNotification]] and on the booking detail page. Positive integer = days before the booking date (except `thankYouReminderDays` which is days after). `null` means the reminder is disabled. Per-booking overrides are deferred to P3.

`songRequestFormEnabled` is a global toggle — when false, the music form feature is hidden across the entire app (no [[MusicFormConfig]] creation, no [[MusicForm]] on the [[Portal]]).

### MusicFormResponse
The client's submitted music preferences, stored on a Booking (zero-to-one). Re-submitting replaces the previous response.

**Fields:**
- `selectedSongIds` — array of [[Song]] IDs chosen from the general list
- `specialRequests` — array of `{ key: string, songId?: string, freeText?: string }` — one entry per key moment; the key matches the label from [[MusicFormConfig]]; value is either a library song or free text
- `notes` — freeform text
- `submittedAt` — timestamp

### Song
An entry in a musician's repertoire library. Every Song has a `userId` — songs are fully per-user, not shared. Used in [[MusicForm]] general selection and key moment autocomplete.

**Fields:** title (required), artist (optional), genre (required — see [[Genre]]), active (boolean — hides without deleting), tags (string array — for search and future playlist generation).

**Seeding:** a static seed catalogue (derived from the existing `mick-form` song list) is presented during onboarding. The musician opts in to the songs they want; selected songs are created as Song records with their `userId`. The seed catalogue is a static file, not a DB table — there is no global song pool.

**Onboarding song selection:** two-level — select/deselect an entire genre (toggles all songs in that genre), or select/deselect individual songs within a genre. Both levels are independent.

### Genre
A closed enum categorising Songs: `Contemporary | Classical | Jazz | Film, TV and Musicals | Bollywood | Christmas`. Managed at the system level — musicians cannot add custom genres for MVP.

### BookingChecklist
A computed, context-sensitive list of actions for a [[Booking]]. Not a stored entity — derived entirely from existing booking state. Displayed on the Booking detail page and shared as the "required actions" content in the [[DigestNotification]].

**Items (in order):** Send quote, Send contract/deposit email, Contract signed, Deposit received, Send music form invite, Song requests received, Send thank you.

Each item has one of three states:
- **Done** — completed; shown with a tick and muted text
- **Outstanding** — not yet done and still applicable; shown with an empty circle
- **Irrelevant** — not done but no longer applicable; hidden entirely

| Item | Done when | Irrelevant when |
|---|---|---|
| Send quote | `quote` [[Communication]] exists | status ≥ CONFIRMED |
| Send contract/deposit email | `contract_cover` or `contract_and_invoice_cover` Communication exists | `contractSignedAt` set AND (`depositReceivedAt` set OR deposit tracking resolves to NONE) |
| Contract signed | `contractSignedAt` set | status is ENQUIRY OR status ≥ SETTLED |
| Deposit received | `depositReceivedAt` set | deposit tracking resolves to NONE OR status is ENQUIRY |
| Send music form invite | `music_form_invite` Communication exists | no [[MusicFormConfig]] on booking OR status is ENQUIRY |
| Song requests received | [[MusicFormResponse]] exists | no MusicFormConfig OR no `music_form_invite` Communication exists |
| Send thank you | `thank_you` Communication exists | today is before booking date |

The checklist is hidden entirely for CANCELLED bookings.

Whether an item appears in the [[DigestNotification]] is controlled by the corresponding `*ReminderDays` field on [[UserProfile]].

### DigestNotification
A daily summary email sent to the musician via Resend. MVP scope. Contains upcoming Bookings and their outstanding [[BookingChecklist]] actions — filtered to items where today falls within the configured reminder window (e.g. `contractReminderDays = 14` means the "send contract" item appears in the digest from 14 days before the booking date).

### MusicFormConfig
The per-booking configuration for a [[MusicForm]]. Set by the musician when sending the `music_form_invite`. Controls:
- Which [[Genre]]s are visible in the general song selection
- Which key moments appear (each defined as a label string, e.g. "Processional", "1st Signing Register") — defaults to the wedding set for `WEDDING` eventType, empty for others

### MusicForm
The client-facing song preference form on the [[Portal]]. Has three sections:
1. **General list** — client selects from the musician's [[Song]] library, browsed by genre (genres shown controlled by [[MusicFormConfig]]); no client details section — identity and booking date are already known from the portal token
2. **Key moments** — one autocomplete field per moment label defined in [[MusicFormConfig]]; searches full [[Song]] library; free-text entry allowed if song is not in the library
3. **Notes** — freeform; covers informal requests and "don't plays"

Key moments default to the wedding set for `WEDDING` eventType but are fully configurable, enabling other event types to define their own special song moments. See also [[Song]], [[MusicFormConfig]], [[MusicFormResponse]].

### Portal
The client-facing public interface at `/booking/:token`. Bypasses Clerk auth — access is validated by the Booking's `portalToken`. Sections are conditionally visible based on booking state — not every booking has every section:

- **Booking summary** — always visible; shows date, venue, sets schedule
- **Contract signing** — visible until signed; client reads the contract, draws or types a signature, submits; API regenerates the PDF with signature embedded, stores in R2, sets `Booking.contractSignedAt`
- **Signed contract download** — visible once `contractSignedAt` is set
- **Music form** — only visible when a [[MusicFormConfig]] exists on the booking (not all bookings have one — e.g. a hotel residency would not)

**Header:** personal — uses the Booking `title` if present, otherwise constructed from customer name + event date. Venue name also shown.

No payment functionality on the portal for MVP.

### Document
A generated PDF stored in Cloudflare R2, associated with a Booking. Two types for MVP: **Contract** and **Invoice**. Stored so the musician has a record of what was sent.

The Contract is generated from a user-editable template (Tiptap JSON, same mechanism as [[Template]]). The client signs it via the [[Portal]] — a drawn or typed signature is captured on a canvas, embedded into a regenerated PDF, and the signed version replaces the original in R2. See ADR-0001.

### Contact Roles (on a Booking)
A Booking has up to three Contact relations, each a separate FK:
- **Customer** (required): the direct payer (e.g. a couple getting married). Rarely repeats.
- **Venue** (optional): the location of the performance. Repeats across bookings; persistent notes (e.g. parking info) live on the Contact record.
- **Referrer** (optional): who sourced the booking (e.g. a booking agent). Repeats across bookings.
