# GigMan — Domain Glossary

A CRM for musicians. The central workflow is managing Bookings with Contacts.

---

## Terms

### Booking
The central entity. Represents a performance engagement — confirmed or in-progress. Connects a Contact to a body of work (sets, song list, documents, communications).  There is no separate concept of "Gig"; Booking covers the full lifecycle of a performance engagement.

**Lifecycle (ordered):** `Enquiry → Confirmed → Deposit Paid → Completed → Invoiced → Settled`
- *Enquiry*: initial interest, not yet confirmed.
- *Confirmed*: engagement is agreed and scheduled.
- *Deposit Paid*: the deposit has been received.
- *Completed*: the performance has taken place.
- *Invoiced*: an invoice has been issued to the Contact.
- *Settled*: the invoice has been paid in full.

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

**Fields include:** issueDate, dueDate (optional), status, and a reference to which Contact it is addressed to (defaults to the Booking's customer but may differ).

### InvoiceLineItem
A freeform line on an [[Invoice]]: description (text) + amount (decimal). No fixed categories.

### Template
A reusable content block stored as Tiptap JSON. Decoupled from rendering — the caller decides whether to render it as email HTML (via Resend) or as a PDF (via @react-pdf/renderer). Users can create custom templates alongside the built-in ones.

**Fields:** name, content (Tiptap JSON), builtInType (optional enum — only set for system-provided templates)

**Built-in types:** `quote | confirmation | contract_cover | invoice_cover | music_form_invite | thank_you | contract`

**Variable substitution:** flat named variables — the API pre-computes a flat context object before rendering. No dot-notation paths or loops in template content. Multi-value data (e.g. sets schedule) is pre-rendered into a single substitution variable (e.g. `{{setsSchedule}}`).

Expected variables include: `{{customerName}}`, `{{bookingDate}}`, `{{venueName}}`, `{{bookingFee}}`, `{{setsSchedule}}`, `{{musicianName}}`, `{{musicianEmail}}`, `{{portalLink}}`, `{{invoiceTotal}}`, `{{invoiceDueDate}}`.

### Communication
A log entry for a communication associated with a Booking. For MVP: outbound only (sent emails). Modelled generically to accommodate inbound messages (email ingestion) in a future release without schema changes.

**Fields:** direction (`OUTBOUND` — MVP only), channel (`EMAIL`), contactId, sentAt, subject, body (rendered HTML), templateId (optional FK — null for manual/freeform messages).

### UserProfile
A per-user settings record (one per `userId`). Provides business details used on invoices, contracts, and the portal.

**Fields:** businessName, address, email, phone, website, photo (R2 URL), logo (R2 URL), socials (JSON object — platform → URL), bankDetails (freeform text), vatNumber (optional), defaultPaymentTermsDays (integer, e.g. 14), invoiceNumberSequence (integer, auto-incremented per user), portalTheme (enum — 2-3 pre-set choices for MVP).

The client-facing [[Portal]] is musician-branded: displays the musician's logo, name, and chosen theme. It is not GigMan-branded. Design reference: WithJoy — photo-forward, elegant typography, premium and personal in feel, mobile-first.

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

### Genre
A closed enum categorising Songs: `Contemporary | Classical | Jazz | Film, TV and Musicals | Bollywood | Christmas`. Managed at the system level — musicians cannot add custom genres for MVP.

### DigestNotification
A daily summary email sent to the musician via Resend. MVP scope. Contains: upcoming Bookings and likely required actions (e.g. contract not yet sent, deposit not yet received, music form not submitted, invoice overdue). Actions are inferred from Booking status and proximity to the event date — not user-configured rules for MVP.

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
The client-facing public interface at `/booking/:token`. Bypasses Clerk auth — access is validated by the Booking's `portalToken`. A client can:
1. View their booking details and Sets schedule
2. Submit their music preferences via [[MusicForm]] (stored as [[MusicFormResponse]])
3. Download their contract PDF

**Header:** personal — uses the Booking `title` if present, otherwise constructed from customer name + event date. Venue name also shown.

No payment functionality on the portal for MVP.

### Document
A generated PDF stored in Cloudflare R2, associated with a Booking. Two types for MVP: **Contract** and **Invoice**. Stored so the musician has a record of what was sent.

The Contract is generated from a user-editable template (Tiptap JSON, same mechanism as [[CommunicationTemplate]]). No e-signature for MVP.

### Contact Roles (on a Booking)
A Booking has up to three Contact relations, each a separate FK:
- **Customer** (required): the direct payer (e.g. a couple getting married). Rarely repeats.
- **Venue** (optional): the location of the performance. Repeats across bookings; persistent notes (e.g. parking info) live on the Contact record.
- **Referrer** (optional): who sourced the booking (e.g. a booking agent). Repeats across bookings.
