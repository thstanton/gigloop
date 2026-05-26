# GigMan — Domain Glossary

A CRM for musicians. The central workflow is managing Bookings with Contacts.

**Design principle — contextual actions:** The [[BookingChecklist]] is the primary interface for progressing a booking. The happy path is: musician opens a booking, sees what needs doing, and completes it from the checklist without navigating elsewhere. Other panels (Invoices, Communications, Documents) exist for specificity and historical detail — not for primary workflow. Every outstanding checklist item should, where possible, carry an inline action that resolves it in one tap. This is the core differentiator: a smart management system that surfaces the right action at the right time, rather than a passive record-keeper the musician has to manually interrogate. Checklist intelligence is scoped to a single booking — cross-booking awareness (e.g. double-booking detection, band member coordination) is explicitly deferred.

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

Two ways to move to `Sent`: (1) **Send** — app emails the invoice via Resend using the appropriate invoice cover template (`deposit_invoice_cover` or `balance_invoice_cover`) and atomically sets the issue date, due date, invoice number, and marks it Sent; (2) **Mark as sent** — sets dates and invoice number and marks it Sent without sending an email, for cases where the invoice was communicated outside the app. Both paths go through dedicated endpoints (`POST /invoices/:id/send` and `POST /invoices/:id/mark-sent`).

**Fields include:** invoiceNumber (nullable — null until sent, assigned from `UserProfile.invoiceNumberSequence` at send time, format `INV-{year}-{NNN}`), issueDate (nullable — null until sent, defaults to today at send time), dueDate (nullable — null until sent, defaults to `issueDate + UserProfile.defaultPaymentTermsDays` if set), status, isDeposit (boolean, default false — at most one deposit invoice per booking), and a reference to which Contact it is addressed to (defaults to the Booking's customer but may differ). When `isDeposit` is true and the invoice is marked Paid, `Booking.depositReceivedAt` is automatically set (if `depositTrackingMode` resolves to `INVOICE`).

**Draft state:** a draft invoice has no invoiceNumber, issueDate, or dueDate. These display as "—" in the UI.

**Balance invoice PDF rendering:** when generating the balance invoice PDF, derive the deposit amount at render time from the deposit [[Invoice]]'s line item total (isDeposit=true). Show a breakdown: subtotal, less deposit paid, balance due. Only show this section if a deposit Invoice exists on the booking. Do not add a stored field for this.

### InvoiceLineItem
A freeform line on an [[Invoice]]: description (text) + amount (decimal). No fixed categories.

### Template
A reusable content block stored as Tiptap JSON. Used for email body rendering and contract display on the [[Portal]]. Custom template creation is deferred to P2; MVP exposes only built-in templates.

**Fields:** name, content (Tiptap JSON), builtInType (optional enum — only set for system-provided templates)

**Built-in email types:** `quote | confirmation | contract_cover | contract_and_deposit_cover | deposit_invoice_cover | balance_invoice_cover | contract_received | deposit_received | music_form_invite | thank_you`

**Built-in document types:** `contract`

Email templates produce the body of an outbound email. The `contract` document template is rendered as HTML on the [[Portal]] for the client to read before signing — it is not used to generate a PDF. The contract template uses the same variable set as email templates — the API reuses the existing `EmailContext` object (booking data + public profile) at render time, with the same variable substitution logic. Invoice PDFs use a fixed layout with no template involvement — appearance customisation is deferred to P2.

The template type encodes what gets attached — the musician picks the template, not individual attachments:

| Template | Portal link | Attachment |
|---|---|---|
| `contract_cover` | ✓ | none — client reads contract as HTML on the portal |
| `contract_and_deposit_cover` | ✓ | deposit [[Invoice]] PDF |
| `deposit_invoice_cover` | — | deposit [[Invoice]] PDF |
| `balance_invoice_cover` | — | balance [[Invoice]] PDF |
| all others | — | none |

`contract_and_deposit_cover` is the common first-contact flow: send the contract link and the deposit invoice together. `deposit_invoice_cover` and `balance_invoice_cover` are for sending invoices independently. The distinction between deposit and balance is encoded in the template type rather than a runtime selection — this prevents accidentally sending the wrong invoice.

The `quote` template is optional — in current practice quotes are sent externally before a booking is created in the app. It becomes more useful once P2 email ingestion allows bookings to be created at the enquiry stage.

**Variable substitution:** flat named variables — the API pre-computes a flat context object before rendering. No dot-notation paths or loops in template content. Multi-value data (e.g. sets schedule) is pre-rendered into a single substitution variable (e.g. `{{setsSchedule}}`). Variables are filtered per template type in the editor — only variables that are meaningful for that template are offered for insertion.

**Variable chips:** in the template editor, variables are inserted as non-editable inline nodes (chips) that display a human-readable label (e.g. "Customer name") but serialise as `{{customerName}}` in the Tiptap JSON. Free-typing variable syntax is not supported — variables must be inserted via the picker.

Available variables: `{{customerName}}`, `{{bookingDate}}`, `{{venueName}}`, `{{bookingFee}}`, `{{setsSchedule}}`, `{{musicianName}}`, `{{musicianEmail}}`, `{{portalLink}}`, `{{invoiceTotal}}`, `{{invoiceDueDate}}`. `{{portalLink}}` always points to `/booking/:token` (the main portal page) — there is no separate `{{contractLink}}` variable. Contract template copy should guide the client to sign from there; this orientation is intentional for first-time portal visitors.

### Communication
A log entry for a communication associated with a Booking. For MVP: outbound only (sent emails). Modelled generically to accommodate inbound messages (email ingestion) in a future release without schema changes.

**Fields:** direction (`OUTBOUND` — MVP only), channel (`EMAIL`), contactId, sentAt (nullable — set only when status is `SENT`), subject, body (rendered HTML), templateId (FK — nullable; records which template seeded the draft, but the body field is authoritative — it stores the exact HTML that was sent, which may have been edited by the musician after template rendering), status (`PENDING | SENT | FAILED`).

**Status lifecycle:** a Communication record is created as `PENDING` before the Resend call. On success it transitions to `SENT` and `sentAt` is set. On failure it transitions to `FAILED` and `sentAt` remains null. The `PENDING` state is added now in anticipation of P2 batch sending, where records will be created as `PENDING` and updated asynchronously by a worker. See ADR-0007.

**Separation of concerns:** rendering and sending are distinct operations. The render step (template → substituted HTML) is performed before the send step and is independent of it. The send endpoint receives final HTML and does not re-render from a template. This preserves the musician's edits and correctly reflects what was actually sent in the Communication record.

**Render endpoint:** `GET /bookings/:bookingId/communications/render?templateId=X&invoiceId=Y` returns `{ subject: string, body: string, missingVariables: string[] }`. The subject is derived from a per-template default (with variable substitution and per-variable fallbacks for null values). `missingVariables` lists the keys of variables that fell back to a default — the compose sheet surfaces these specifically so the musician can fix the booking details before sending.

### PublicProfile
The public, portal-visible half of the musician's settings (one per `userId`). Safe to return to unauthenticated portal clients — contains no sensitive data. See ADR-0002.

**Fields:** businessName, displayName, bio, email, phone, logoUrl (R2 URL), brandColour (hex), photo (R2 URL), website, socials (JSON — platform → URL), portalTheme.

**`portalTheme` enum:** `BOLD_ROMANTIC | BOLD_MODERN | LIGHT_ROMANTIC | LIGHT_MODERN`. Each preset bundles a layout style (Bold = full-bleed photo hero; Light = clean white with contained photo) with a font pairing (Romantic = Cormorant Garamond/Lato; Modern = DM Sans). Four themes cover the full matrix.

The client-facing [[Portal]] is musician-branded: displays the musician's logo, photo, name, and chosen theme. It is not GigMan-branded. Design reference: WithJoy — photo-forward, elegant typography, premium and personal in feel, mobile-first.

**Graceful degradation:** `publicProfile` always exists by the time emails are sent (API enforces this). Missing optional fields degrade gracefully: no photo/logo → layout renders without them (no broken images). No `brandColour` → neutral fallback (`#1a1a1a`). The portal must never look broken due to incomplete profile setup.

**Theme implementation:** two layout components (`BoldPortalLayout` / `LightPortalLayout`) × two CSS font variants (`romantic` / `modern`) applied within each — four combinations total. Bold = full-bleed photo hero (photo fills viewport width). Light = clean white with contained photo. Romantic = Cormorant Garamond/Lato font pairing. Modern = DM Sans.

`brandColour` is applied to buttons and links only — everything else uses neutral colours (white/near-white backgrounds, dark text).

### UserProfile
The private, authenticated-only half of the musician's settings (one per `userId`). Never returned to portal clients. See ADR-0002.

**Fields:** address, bankDetails (encrypted at rest — see ADR-0003), vatNumber, defaultPaymentTermsDays, invoiceNumberSequence, invoiceSequenceYear, depositTrackingMode, depositPercentage (nullable integer 1–100 — the default deposit % of the booking fee; null means no default set), digestEmailEnabled, songRequestFormEnabled, quoteReminderDays, contractReminderDays, depositInvoiceReminderDays, balanceInvoiceReminderDays, musicFormReminderDays, thankYouReminderDays.

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

**Items (in order):** Send quote, Create deposit invoice, Send contract/deposit email, Contract signed, Deposit received, Create balance invoice, Send music form invite, Song requests received, Send thank you.

Each item has one of four states:
- **Done** — completed; shown with a tick and muted text
- **Outstanding** — not yet done and still applicable; shown with an empty circle
- **Failed** — a send was attempted but the most recent relevant Communication has `status = FAILED`; shown with a warning indicator and "Last send failed" message. Takes priority over Outstanding.
- **Irrelevant** — not done but no longer applicable; hidden entirely

A Communication only counts as "Done" if `status = SENT`. `PENDING` and `FAILED` records do not satisfy the Done condition. "Most recent attempt" is used for Failed — if a retry succeeds, the item reverts to Done. Items in the `failed` state carry a **Retry** shortcut that opens the compose sheet pre-loaded with the same template type — this is the primary recovery path, consistent with the contextual actions principle.

| Item | Done when | Failed when | Irrelevant when |
|---|---|---|---|
| Send quote | `quote` [[Communication]] with status SENT exists | most recent `quote` Communication is FAILED | status ≥ CONFIRMED |
| Create deposit invoice | deposit [[Invoice]] exists (isDeposit=true) | — | deposit tracking resolves to NONE |
| Send contract/deposit email | `contract_cover` or `contract_and_deposit_cover` Communication with status SENT exists | most recent such Communication is FAILED | `contractSignedAt` set AND (`depositReceivedAt` set OR deposit tracking resolves to NONE) |
| Contract signed | `contractSignedAt` set | — | status is ENQUIRY OR status ≥ SETTLED |
| Deposit received | `depositReceivedAt` set | — | deposit tracking resolves to NONE OR status is ENQUIRY |
| Create balance invoice | balance [[Invoice]] exists (isDeposit=false) | — | status is ENQUIRY |
| Send music form invite | `music_form_invite` Communication with status SENT exists | most recent `music_form_invite` Communication is FAILED | no [[MusicFormConfig]] on booking OR status is ENQUIRY |
| Song requests received | [[MusicFormResponse]] exists | — | no MusicFormConfig OR no `music_form_invite` Communication with status SENT exists | This item is intentionally passive — the client may choose to communicate preferences informally rather than via the form, and that is acceptable. No chase-up action is provided. |
| Send thank you | `thank_you` Communication with status SENT exists | most recent `thank_you` Communication is FAILED | today is before booking date |

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

- **Booking summary** — always visible; shows date, venue, sets schedule, and fee. Opens with a greeting using the customer name (e.g. "Hello, Jane!"). Internal notes and event type are never shown to the client.
- **Contract signing** — visible until signed; client reads the contract, draws or types a signature (draw is default, type is the fallback), submits; API generates the signed PDF, stores in R2, sets `Booking.contractSignedAt`
- **Signed contract download** — visible once `contractSignedAt` is set
- **Music form link** — only visible when a [[MusicFormConfig]] exists on the booking; links to the music form sub-page

**Routing:** the portal has three routes sharing the same musician branding:
- `/booking/:token` — main page (summary, signed contract download, music form link)
- `/booking/:token/contract` — read contract + sign; redirects to main page on success (with `?signed=1` param — main page shows a one-time success banner "Your contract has been signed — thank you!"); redirects immediately to main page if already signed. Signature canvas and submit are gated behind an "I have read and agree to the above" checkbox.
- `/booking/:token/music` — song selection form; redirects to main page on success

**API calls:** three endpoint groups, each scoped to a route:
- `GET /booking/:token` — returns: booking summary fields (date, fee, title, customerName, venueName, sets), publicProfile (full), contractSignedAt (timestamp or null), signedContractUrl (R2 public URL or null), hasMusicForm (boolean)
- `GET /booking/:token/contract` — returns `{ content: TiptapJSON, title: string }` where `content` is the contract template's Tiptap JSON with variables already substituted as plain text nodes (server-side). The frontend renders using the Tiptap React viewer — no `dangerouslySetInnerHTML`, XSS structurally impossible.
- `POST /booking/:token/sign` — signature submission; body: `{ signature: string }` (base64-encoded PNG — same format for draw and type methods; the frontend renders typed signatures to canvas before submission). The API extracts the client IP from `X-Forwarded-For` (fallback: socket address), stores it in `Booking.contractSignedFromIp` (new nullable field, requires migration), and includes it in the signed PDF signature section.
- `GET /booking/:token/music` — music form config + song list *(deferred — separate build session)*
- `POST /booking/:token/music` — music form submission *(deferred)*

**Header:** personal — uses the Booking `title` if present, otherwise constructed from customer name + event date. Venue name also shown.

No payment functionality on the portal for MVP.

**Footer:** "Powered by GigMan" — small, tasteful, at the bottom of every portal page.

**Signing notification:** when the client signs, the API sends a notification email to the musician (via Resend). Subject: "[CustomerName] has signed your contract for [booking title]". Body is plain text: customer name, booking date, venue (if set), link to `/admin/bookings/:id`. Context-aware deposit section:
- If `depositTrackingMode` resolves to `NONE`: no deposit mention.
- If deposit not yet received and a sent deposit invoice exists with a `dueDate`: "Awaiting deposit — due [date]".
- If deposit not yet received and no sent deposit invoice (or no due date): "Awaiting deposit."
- If deposit already received (`depositReceivedAt` set): include a link to `/admin/bookings/:id` prompting the musician to mark the booking as Confirmed.

This is a system-generated email (not a [[Template]]).

**Cancelled bookings:** the portal still loads for cancelled bookings (the token remains valid). A notice is shown ("This booking has been cancelled"). The booking summary is visible. Contract signing is hidden. Signed contract download remains visible if it exists.

### Document
A generated PDF stored in Cloudflare R2, associated with a Booking. Two types: **Invoice** (MVP) and **SignedContract** (P2, portal feature).

**Invoice PDF:** generated at invoice send time (`POST /invoices/:id/send`), stored in R2, and attached to the outbound email. Uses a fixed `@react-pdf/renderer` layout with Tiptap-JSON-driven content sections (variable substitution + line items table). Balance invoices include a deposit deduction section (subtotal, less deposit, balance due) when a deposit [[Invoice]] exists on the booking.

**Signed contract PDF:** generated only after the client signs via the [[Portal]] — a drawn or typed signature is captured on a canvas, embedded into a PDF, and stored in R2. No unsigned contract PDF is ever generated or stored. The [[Portal]] renders the contract content as HTML (from the Tiptap template) for the client to read before signing. See ADR-0001.

The signed contract PDF is generated using pdfmake (same library as invoices) via a `renderTiptapToPdfmake` converter that maps Tiptap JSON nodes (paragraphs, bold, italic, headings) directly to pdfmake content — no HTML→PDF step needed. Variable substitution is applied before conversion. The PDF structure is: musician header (name/logo), contract body, signature section (customer name, timestamp, signature image).

### Contact Roles (on a Booking)
A Booking has up to three Contact relations, each a separate FK:
- **Customer** (required): the direct payer (e.g. a couple getting married). Rarely repeats.
- **Venue** (optional): the location of the performance. Repeats across bookings; persistent notes (e.g. parking info) live on the Contact record.
- **Referrer** (optional): who sourced the booking (e.g. a booking agent). Repeats across bookings.
