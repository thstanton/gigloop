# GigMan — Domain Glossary

A CRM for musicians. The central workflow is managing Bookings with Contacts.

**Design principle — contextual actions:** The [[BookingChecklist]] is the primary interface for progressing a booking. The happy path is: musician opens a booking, sees what needs doing, and completes it from the checklist without navigating elsewhere. Other panels (Invoices, Communications, Documents) exist for specificity and historical detail — not for primary workflow. Every outstanding checklist item should, where possible, carry an inline action that resolves it in one tap. This is the core differentiator: a smart management system that surfaces the right action at the right time, rather than a passive record-keeper the musician has to manually interrogate. Checklist intelligence is scoped to a single booking — cross-booking awareness (e.g. double-booking detection, band member coordination) is explicitly deferred.

**Design principle — template + overrides:** System-provided defaults (seeded [[PerformanceFormat]]s, built-in [[Template]]s, [[UserProfile]] reminder offsets) act as templates. Per-booking configuration is always a copy of that template, editable by the musician without touching the original. Further customisation of templates and user-defined defaults is a P2 concern — MVP ships sensible system defaults only.

**Design principle — enums for closed lifecycles only:** Use Prisma enums for states that are genuinely exhaustive domain constants (e.g. `BookingStatus`, `InvoiceStatus`). Avoid them for extensible classifier fields (event categories, genres, format types) — store those as validated strings instead. Adding a new value to an extensible enum requires a DB migration and cascading code changes; a constants list requires only a deploy.

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

**Pre-confirmation tracking:** two nullable timestamp fields — `contractSignedAt` and `depositReceivedAt` — record when each arrived.

`depositReceivedAt` behaviour is controlled by `depositTrackingMode`:
- `INVOICE` — automatically set when the deposit [[Invoice]] is marked Paid.
- `MANUAL` — set directly by the musician on the Booking.
- `NONE` — deposit not tracked.

`UserProfile.depositTrackingMode` is the global default. `Booking.depositTrackingMode` is a nullable per-booking override; `null` means inherit from UserProfile. Neither triggers automatic status transitions — the musician still moves status to `Confirmed` manually.

**Planned deprecation:** `depositTrackingMode` (including the MANUAL mode) will be removed when the [[BookingChecklistItem]] model ships. Whether to track the deposit, and how, will be configured through the checklist template instead — the `deposit_received` item's presence and `autoCompleteRule` determine tracking behaviour. At that point `depositReceivedAt` on Booking becomes purely derived from the deposit [[Invoice]]'s paid state (i.e. a property of the invoice, not the booking).

Status transitions are not enforced by the API — a Booking can move freely between any statuses.

**Top-level fields:**
- **status**: see lifecycle above
- **date**: the date (and optionally time) of the performance
- **title** (optional): human-readable label; useful when the booking is for a named event (e.g. a festival) not easily derived from the customer name
- **fee**: the agreed total amount (Option A — independent of invoice line items; represents what was verbally agreed, used in the contract)
- **notes** (optional): freeform internal notes for the musician
- **eventType**: string — one of `WEDDING | CORPORATE | PRIVATE | RESIDENCY | FESTIVAL | OUTDOOR | FUNCTION | OTHER`; a display classifier and filter axis; stored as a plain string (not a Prisma enum), validated in application code; decoupled from [[PerformanceFormat]] behaviour
- **customerId** (required FK → Contact)
- **venueId** (optional FK → Contact): venue address/info lives on the Contact record, not duplicated
- **bookingAgentId** (optional FK → Contact)
- **contracts**: zero-to-many [[Contract]] entities; at most one is in a non-VOID state at any time
- **sets**: ordered list of [[Set]] entities
- **songList** (optional): song requirements for the booking — deferred to [[song-library]] feature

### Contract
A contract document associated with a [[Booking]]. A Booking can have many Contracts over time (full history preserved), but at most one may be in a non-VOID state — the active contract. See ADR-0017.

**Lifecycle:** `DRAFT → SENT → SIGNED → VOID`
- *DRAFT*: contract body created; content editable; no email sent yet.
- *SENT*: contract email sent; portal link is live; content becomes read-only.
- *SIGNED*: client has signed via the [[Portal]]; content read-only.
- *VOID*: superseded or cancelled by the musician. A new Contract can be created on the same Booking once the previous one is voided.

**Fields:**
- `content` — Tiptap JSON; the contract body with variables already substituted as plain text at creation time (same as the former `Booking.contractContent`). Authoritative source for what the client reads on the Portal. See ADR-0013.
- `status` — `DRAFT | SENT | SIGNED | VOID`
- `signedAt` — timestamp set when the client signs; null until then
- `signedFromIp` — client IP captured at signing time; included in the signed PDF
- `voidedAt` — timestamp set when voided

A Booking's "active contract" is the single Contract with `status != VOID`. `contractSignedAt` on the booking detail view is derived from `activeContract.signedAt`.

Only one Contract per Booking may be non-VOID at any time — enforced at the application layer (voiding the existing contract is a prerequisite for creating a new one).

### Contact
A person or organisation the musician does business with. Role-agnostic — the role on any given Booking is determined by which FK references it. A Contact with associated Bookings (in any role) cannot be deleted.

**Fields (all optional except name):**
- name (required)
- email, phone, address (freeform text), notes
- **primaryRole** (optional string — one of `CUSTOMER | VENUE | BOOKING_AGENT`): the role this contact most commonly plays. Used to pre-populate the correct field when creating a booking from their detail page, and to show a role badge in contact lists and detail views. Stored as a plain string (not a Prisma enum) — validated in application code against the constants list. A contact can still appear in any role on any booking regardless of `primaryRole`; this is a hint for the UI, not a constraint.
- *Venue extras:* parkingInfo, accessInfo, equipmentAvailable
- *Booking agent extras:* website, commissionArrangement (freeform text)

All fields live on the Contact table as nullable columns — no sub-type tables. A Contact can serve as both a venue and a booking agent on different Bookings; the extra fields are always available regardless of role.

### Set
A scheduled performance slot within a Booking — always traceable to a [[PerformanceFormat]]. Multiple Sets form the running order for the day and constitute the performance schedule in the contract. Fields:
- **duration** (required): length in minutes (e.g. 45)
- **startTime** (optional): the time the set begins (e.g. 14:00) — set at the booking level; not on the format template
- **label** (optional): occasion name (e.g. "Ceremony", "Drinks Reception")
- **order** (required): integer used to preserve sequence when start times are absent
- **performanceFormatId** (optional FK → [[PerformanceFormat]]): records which format this set was copied from; used to group sets by format in the UI

Sets are created by applying a [[PerformanceFormat]] to a booking — the format's default slots are copied as editable Set records. Ad-hoc sets without a format association are not permitted. Song requirements within a Set (must-haves, don't-plays, special roles) are deferred to the Song Library feature.

### Invoice
A financial document issued to a Contact for a Booking. A Booking can have multiple Invoices (e.g. a deposit invoice followed by a balance invoice, or a single full invoice — the musician decides). Has many [[InvoiceLineItem]]s.

**Status:** `Draft | Sent | Paid | Void` (stored). *Overdue* is derived — not a stored state — inferred when status is `Sent`, a due date is set, and that date has passed. A Void invoice is preserved for history but no longer active; a new invoice can be created on the same booking after voiding.

Two ways to move to `Sent`: (1) **Send** — app emails the invoice via Resend using the appropriate invoice cover template (`deposit_invoice_cover` or `balance_invoice_cover`) and atomically sets the issue date, due date, invoice number, and marks it Sent; (2) **Mark as sent** — sets dates and invoice number and marks it Sent without sending an email, for cases where the invoice was communicated outside the app. Both paths go through dedicated endpoints (`POST /invoices/:id/send` and `POST /invoices/:id/mark-sent`).

**Fields include:** invoiceNumber (nullable — null until sent, assigned from `UserProfile.invoiceNumberSequence` at send time, format `INV-{year}-{NNN}`), issueDate (nullable — null until sent, defaults to today at send time), dueDate (nullable — null until sent, defaults to `issueDate + UserProfile.defaultPaymentTermsDays` if set), status, isDeposit (boolean, default false — at most one deposit invoice per booking), and a reference to which Contact it is addressed to (defaults to the Booking's customer but may differ). When `isDeposit` is true and the invoice is marked Paid, `Booking.depositReceivedAt` is automatically set (if `depositTrackingMode` resolves to `INVOICE`).

**Draft state:** a draft invoice has no invoiceNumber, issueDate, or dueDate. These display as "—" in the UI.

**Balance invoice PDF rendering:** when generating the balance invoice PDF, derive the deposit amount at render time from the deposit [[Invoice]]'s line item total (isDeposit=true). Show a breakdown: subtotal, less deposit paid, balance due. Only show this section if a deposit Invoice exists on the booking. Do not add a stored field for this.

### InvoiceLineItem
A line on an [[Invoice]]: description (text) + amount (decimal).

**First line item — service description:** when an invoice is created, the first line item description is pre-populated from the booking's performance formats and sets (e.g. "Wedding Ceremony (30 min), Drinks Reception (90 min), Evening Reception (45 min × 2)"). This gives clients the service detail they typically request. The amount defaults to the booking fee (or deposit percentage for deposit invoices). The description is fully editable — pre-population is a convenience, not a constraint.

**Additional line items:** free text for anything beyond the core service — travel, equipment hire, accommodation, etc. No fixed categories.

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

**Identity fields (explicit columns):** businessName, displayName, bio, email, phone, logoUrl (R2 URL — client-facing only; see ADR-0014), photo (R2 URL), website, socials (JSON — platform → URL).

**`clientPortalConfig` (JSON column):** all client portal appearance and behaviour preferences. See ADR-0015. Shape:
- `theme` — `BOLD_ROMANTIC | BOLD_MODERN | LIGHT_ROMANTIC | LIGHT_MODERN` (default: `LIGHT_MODERN`)
- `brandColour` — hex string (default: `#1a1a1a`)
- `heroImage` — `'piano'` | `'stage'` | `null` (BOLD themes only; null = solid brand colour block)
- `showContactPhoto` — boolean (default: false)
- `showContactEmail` — boolean (default: true)
- `showContactPhone` — boolean (default: false)

Named `clientPortalConfig` (not `portalConfig`) to distinguish from future portals (e.g. band member portal) that will use sibling keys. See ADR-0015.

**`theme` values:** each preset bundles a layout style (Bold = hero section + dark background; Light = clean white, spacious) with a font pairing (Romantic = Caveat display + Commissioner body; Modern = Lexend Deca display + Commissioner body). Four themes cover the full matrix.

**BOLD hero section:** full-width block at the top of the portal. If `heroImage` is set, the image fills the block with a dark gradient overlay. If `heroImage` is null, a solid `brandColour` block is used. LIGHT themes have no hero section.

**Predefined hero images:** a small curated set of photographic assets (`/piano.png` — intimate black-and-white piano scene; `/stage.png` — atmospheric lit stage) stored in the web `public/` folder. Custom image upload is deferred to P2.

The client-facing [[Portal]] is musician-branded: displays the musician's logo, name, and chosen theme. It is not GigMan-branded. Design reference: WithJoy — elegant typography, premium and personal in feel, mobile-first.

**Graceful degradation:** `publicProfile` always exists by the time emails are sent (API enforces this). Missing optional fields degrade gracefully: no logo → layout renders without it. No `brandColour` → neutral fallback (`#1a1a1a`). No `heroImage` on a BOLD theme → solid brand colour hero block. The portal must never look broken due to incomplete profile setup.

`brandColour` is applied to hero overlays, CTAs, and links. Admin top bar always uses `businessName` as text — `logoUrl` is not rendered in the admin UI. See ADR-0014.

**Portal configuration:** managed via the Portal Preview page (`/admin/portal-preview`). Settings page "Business" section owns the logo upload; settings page "Portal" section is a single link to the Portal Preview. Theme, hero image, brand colour, and contact card visibility are all configured via a sheet within the Portal Preview.

**Contact card:** displayed on the main portal page — bottom of the page on mobile; sticky right panel on desktop (main page only; contract and music form pages stay single-column). Shows the musician's name, business name, and optionally photo, email, and phone. Name and business name are always visible when the card renders. Photo, email, and phone each have a per-field visibility toggle (in `clientPortalConfig`). Defaults: email shown, photo and phone hidden. Toggles live in the Customise sheet; actual field values (email, phone, photo) are set in the settings Business section. The sheet shows current values as read-only context.

### UserProfile
The private, authenticated-only half of the musician's settings (one per `userId`). Never returned to portal clients. See ADR-0002.

**Business fields (explicit columns):** address, bankDetails (encrypted at rest — see ADR-0003), vatNumber, defaultPaymentTermsDays, invoiceNumberSequence, invoiceSequenceYear, depositTrackingMode, depositPercentage (nullable integer 1–100 — the default deposit % of the booking fee; null means no default set), digestEmailEnabled, songRequestFormEnabled.

**`preferences` (JSON column):** all workflow and behaviour preferences, gated by subscription tier at write time. See ADR-0015. Contains:
- `checklistDefaults` — the musician's default [[BookingChecklistItem]] template; an ordered array of item definitions (key, label, completedBy, dependsOn, autoCompleteRule, requiredForStatus, reminderDays). Seeded from system defaults on first access. The system defaults represent the current 10-item workflow. Custom items (no `key`) can be appended. Per-item `reminderDays` replaces the former flat `*ReminderDays` columns — null means no reminder, positive integer = days before booking date (days after for `send_thank_you`).
- Future preference domains (dashboard widget config, feature toggles, etc.) are added as sibling keys.

**Invoice numbering:** format `INV-{year}-{NNN}` (e.g. `INV-2025-001`). `invoiceNumberSequence` is a per-year counter; `invoiceSequenceYear` records the year it was last reset. Both reset each January. Subject to revision.

`songRequestFormEnabled` is a global toggle — when false, the music form feature is hidden across the entire app (no [[MusicFormConfig]] creation, no [[MusicForm]] on the [[Portal]]).

### MusicFormResponse
The client's submitted music preferences, stored on a Booking (zero-to-one). Re-submitting replaces the previous response.

**Fields:**
- `selectedSongIds` — array of [[Song]] IDs chosen from the general list
- `specialRequests` — array of `{ key: string, songId?: string, freeText?: string }` — one entry per key moment; the key matches the `label` from [[MusicFormConfig]]; value is either a library song or free text
- `notes` — freeform text
- `submittedAt` — timestamp

**On submission:** the API generates a `SONG_LIST` [[Document]] PDF (booking header, key moments + chosen songs, general song list grouped by genre, notes, timestamp), stores it in R2, and sends a notification email to the musician containing the full list inline (key moments + general selections) with the PDF attached. The PDF is available for download from the booking detail page (admin) and the [[Portal]] documents section (client).

**Admin view:** key moments + chosen songs displayed inline in the Music Form section on the booking detail page. Full general song list accessible via a sheet ("View full song list"). The musician cannot edit the response — only the client can re-submit.

### Song
An entry in a musician's repertoire library. Every Song has a `userId` — songs are fully per-user, not shared. Used in [[MusicForm]] general selection and key moment autocomplete.

**Fields:** title (required), artist (optional), genre (required — string, one of `CONTEMPORARY | CLASSICAL | JAZZ | FILM_TV_MUSICALS | BOLLYWOOD | CHRISTMAS`; stored as a plain string, not a Prisma enum), active (boolean — hides without deleting), tags (string array — for search and future playlist generation).

**Seeding:** a static seed catalogue (derived from the existing `mick-form` song list) is presented during onboarding. The musician opts in to the songs they want; selected songs are created as Song records with their `userId`. The seed catalogue is a static file, not a DB table — there is no global song pool.

**Onboarding song selection:** two-level — select/deselect an entire genre (toggles all songs in that genre), or select/deselect individual songs within a genre. Both levels are independent.

### Genre
A string value categorising Songs: `CONTEMPORARY | CLASSICAL | JAZZ | FILM_TV_MUSICALS | BOLLYWOOD | CHRISTMAS`. Stored as a plain string (not a Prisma enum) — new genres can be added without a DB migration. Validated in application code against a constants list. Managed at the system level — musicians cannot add custom genres for MVP.

### BookingChecklistItem
A stored action item on a [[Booking]], representing something that needs to happen to progress or complete the booking. Together the items form the booking's checklist — a project management-style task list that surfaces the right action at the right time. See ADR-0016.

Items are **seeded at booking creation** from the musician's `checklistDefaults` template in [[UserProfile]]`.preferences` (system defaults on first use). Each item is an independent DB record with stored state — never computed at read time.

**Fields:**
- `key` — string identifier for system items (e.g. `create_contract`, `contract_signed`); null for user-defined custom items
- `label` — display label; system items have a default, custom items are user-defined
- `completedBy` — `USER | CUSTOMER | BAND_MEMBER`; declares which actor resolves this item
- `state` — `PENDING | DONE | FAILED | BLOCKED | SKIPPED`
- `order` — integer preserving display sequence
- `dependsOn` — `string[]`; keys of items that must be DONE before this item unblocks (transitions from BLOCKED → PENDING automatically)
- `autoCompleteRule` — optional JSON; when present, the system evaluates the rule on relevant business events and sets state to DONE automatically. When absent, the item is manual-only. Rule types: `bookingField` (done when a named Booking field is non-null), `communicationSent` (done when a SENT Communication of a given template type exists), `invoiceExists` (done when an invoice of the given kind exists), `musicFormResponse` (done when a MusicFormResponse exists).
- `requiredForStatus` — optional `BookingStatus`; advisory association — the UI warns the musician if they attempt to advance the booking to this status while this item is PENDING or FAILED, and prompts them to advance when all items for this status become DONE. The API does not enforce this gate.
- `completedAt` — timestamp set when state transitions to DONE
- `reminderDays` — how many days before the booking date this item surfaces in the [[DigestNotification]] and Dashboard Actions widget; null = no reminder

**States:**
- **PENDING** — not yet done, applicable, unblocked
- **DONE** — completed (auto or manual); shown with a tick
- **FAILED** — a system action associated with this item was attempted and failed (e.g. email send failed); shown with a warning
- **BLOCKED** — one or more `dependsOn` items are not yet DONE; shown as inactive
- **SKIPPED** — was applicable but is no longer relevant (e.g. booking advanced past the point where this item applied); hidden from the active checklist

Items in the FAILED state carry a **Retry** shortcut consistent with the contextual actions design principle. The checklist is hidden entirely for CANCELLED bookings. CUSTOMER-completedBy items (e.g. contract signed, music form submitted) are resolved by portal actions — their `autoCompleteRule` fires when the corresponding booking field is set.

**System item keys and their auto-complete rules:**

| Key | completedBy | autoCompleteRule | requiredForStatus |
|---|---|---|---|
| `send_quote` | USER | communicationSent: quote | — |
| `create_deposit_invoice` | USER | invoiceExists: isDeposit=true | — |
| `create_contract` | USER | bookingField: contractContent | — |
| `send_contract` | USER | communicationSent: contract_cover \| contract_and_deposit_cover | — |
| `contract_signed` | CUSTOMER | bookingField: contractSignedAt | CONFIRMED |
| `deposit_received` | CUSTOMER | bookingField: depositReceivedAt | CONFIRMED |
| `create_balance_invoice` | USER | invoiceExists: isDeposit=false | — |
| `send_music_form_invite` | USER | communicationSent: music_form_invite | — |
| `song_requests` | CUSTOMER | musicFormResponse | — |
| `send_thank_you` | USER | communicationSent: thank_you | — |

### BookingChecklist
The ordered collection of [[BookingChecklistItem]] records for a given [[Booking]]. Not a separate model — a logical grouping term. Displayed on the Booking detail page; outstanding items feed the [[DigestNotification]] and Dashboard Actions widget filtered by each item's `reminderDays` window.

### DigestNotification
A daily summary email sent to the musician via Resend. MVP scope. Contains upcoming Bookings and their outstanding [[BookingChecklistItem]] records — filtered to items where today falls within the item's `reminderDays` window (e.g. `reminderDays = 14` on the `send_contract` item means it appears in the digest from 14 days before the booking date). Items with `reminderDays = null` never appear in the digest.

### MusicFormConfig
The per-booking configuration for a [[MusicForm]]. Created at booking creation (if [[PerformanceFormat]]s are applied) or from the Music Form section on the booking detail page. Independent of the send invite action — the config may exist before the invite is sent.

**Fields:**
- `keyMoments` — `{ label: string, section: string }[]`; `section` is the format label the moment came from (e.g. "Wedding Ceremony"), used to group moments in the portal form. Copied from applied formats; editable per-booking without affecting the format template.
- `enabledGenres` — `string[]`; the genres shown in the general song selection. Copied from applied formats (union of all format defaults); editable.

The `Send music form invite` [[BookingChecklist]] item is irrelevant until a `MusicFormConfig` exists on the booking.

### MusicForm
The client-facing song preference form on the [[Portal]]. Has three sections:
1. **General list** — client selects from the musician's [[Song]] library; browsed via genre tabs (one tab per enabled genre in [[MusicFormConfig]]) with a search bar that queries across all enabled genres; no client details section — identity and booking date are already known from the portal token
2. **Key moments** — one autocomplete field per moment, grouped by section (format label) as defined in [[MusicFormConfig]]; searches the full [[Song]] library (not limited to enabled genres); free-text entry allowed if song is not in the library
3. **Notes** — freeform; covers informal requests and "don't plays"

See also [[Song]], [[MusicFormConfig]], [[MusicFormResponse]].

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
- `GET /booking/:token/contract` — returns `{ content: TiptapJSON, title: string }` where `content` is `Booking.contractContent` (variables already substituted at creation time). Returns 404 if `contractContent` is null. The frontend renders using the Tiptap React viewer — no `dangerouslySetInnerHTML`, XSS structurally impossible.
- `POST /booking/:token/sign` — signature submission; body: `{ signature: string }` (base64-encoded PNG — same format for draw and type methods; the frontend renders typed signatures to canvas before submission). The API extracts the client IP from `X-Forwarded-For` (fallback: socket address), stores it in `Booking.contractSignedFromIp` (new nullable field, requires migration), and includes it in the signed PDF signature section.
- `GET /booking/:token/music` — returns [[MusicFormConfig]] (keyMoments with section labels, enabledGenres) + musician's song library filtered to enabled genres; also returns existing [[MusicFormResponse]] if already submitted (to pre-populate a re-submission)
- `POST /booking/:token/music` — music form submission; body: `{ selectedSongIds: string[], specialRequests: { key: string, songId?: string, freeText?: string }[], notes?: string }`; generates SONG_LIST PDF, stores in R2, sends notification email to musician

**Header:** personal — uses the Booking `title` if present, otherwise constructed from customer name + event date. Venue name also shown.

No payment functionality on the portal for MVP.

**Footer:** "Powered by GigMan" — small, tasteful, at the bottom of every portal page.

**Portal preview mode:** the musician can preview their portal without performing client actions. Two entry points:
- **From booking detail** — "Client portal" link becomes `/booking/:token?preview=admin`. The portal detects `?preview=admin` in search params, disables all mutations (contract signing, music form submit), and renders a sticky banner at the top: "Preview — [back link to booking]". No Clerk auth check needed since the token is still valid.
- **From settings** — "Configure portal →" link opens `/admin/portal-preview` (Clerk-authenticated admin route). This page renders the portal layout and [[BookingSummary]] using the musician's real profile + placeholder booking data (same approach as `PREVIEW_SAMPLES` in the email template editor). A sticky banner at the top has a "Customise" button that opens a sheet for editing portal appearance settings (theme, hero image, brand colour) live; changes are reflected immediately in the preview below. A "Save" button in the sheet commits via `PATCH /me/public`.

**Signing notification:** when the client signs, the API sends a notification email to the musician (via Resend). Subject: "[CustomerName] has signed your contract for [booking title]". Body is plain text: customer name, booking date, venue (if set), link to `/admin/bookings/:id`. Context-aware deposit section:
- If `depositTrackingMode` resolves to `NONE`: no deposit mention.
- If deposit not yet received and a sent deposit invoice exists with a `dueDate`: "Awaiting deposit — due [date]".
- If deposit not yet received and no sent deposit invoice (or no due date): "Awaiting deposit."
- If deposit already received (`depositReceivedAt` set): include a link to `/admin/bookings/:id` prompting the musician to mark the booking as Confirmed.

This is a system-generated email (not a [[Template]]).

**Cancelled bookings:** the portal still loads for cancelled bookings (the token remains valid). A notice is shown ("This booking has been cancelled"). The booking summary is visible. Contract signing is hidden. Signed contract download remains visible if it exists.

### Document
A generated PDF stored in Cloudflare R2, associated with a Booking. Three types (stored as `DocumentType` Prisma enum): **INVOICE**, **CONTRACT**, **SONG_LIST**.

**Invoice PDF:** generated at invoice send time (`POST /invoices/:id/send`), stored in R2, and attached to the outbound email. Uses a fixed `@react-pdf/renderer` layout with Tiptap-JSON-driven content sections (variable substitution + line items table). Balance invoices include a deposit deduction section (subtotal, less deposit, balance due) when a deposit [[Invoice]] exists on the booking.

**Signed contract PDF:** generated only after the client signs via the [[Portal]] — a drawn or typed signature is captured on a canvas, embedded into a PDF, and stored in R2. No unsigned contract PDF is ever generated or stored. The [[Portal]] renders `Booking.contractContent` (Tiptap JSON, variables pre-substituted at creation time) as HTML for the client to read before signing — the contract template is not re-rendered at portal time. See ADR-0001 and ADR-0013.

The signed contract PDF is generated using pdfmake (same library as invoices) via a `renderTiptapToPdfmake` converter that maps Tiptap JSON nodes (paragraphs, bold, italic, headings) directly to pdfmake content — no HTML→PDF step needed. Variable substitution is applied before conversion. The PDF structure is: musician header (name/logo), contract body, signature section (customer name, timestamp, signature image).

**Song list PDF (`SONG_LIST`):** generated at [[MusicFormResponse]] submission time. Structure: booking header (musician name, customer, date, venue), key moments section (moment label + chosen song, grouped by format section), general song requests (selected songs grouped by genre), notes (if present), submitted timestamp. Stored in R2 as a Document; available for download from the booking detail page (admin) and the [[Portal]] documents section (client).

### Dashboard
The home screen. Action-oriented — designed for the musician's morning check-in. No analytics (deferred). Three widgets stacked vertically:

1. **Actions** — one outstanding actionable item per upcoming booking, filtered by the same reminder window as [[DigestNotification]]. Only surfaces items the musician can directly act on (send email, create invoice); passive-wait items (contract signed, deposit received, song requests received) are omitted. Tapping navigates to the booking detail page where the inline checklist action lives. Items in `failed` state are shown in a warning colour.

2. **Upcoming gigs** — bookings in the next 90 days (excluding CANCELLED), capped at 8 items. Each row: date, title or customer name, venue name, status pill. Tap → booking detail.

3. **Calendar** — month view. Booked dates show dots (one per booking). Tapping a date with one booking → booking detail. Tapping a date with multiple bookings → inline list of that day's bookings. Tapping an empty date → new booking pre-filled with that date. Today highlighted. Prev/next month navigation.

**Actionable checklist items shown in Actions widget (priority order):** Send quote, Create deposit invoice, Send contract & deposit email, Create balance invoice, Send music form invite, Send thank you. Only USER-completedBy items with an associated action (shortcut) are shown — passive-wait items (CUSTOMER-completedBy) are omitted. Reminder windows come from each item's `reminderDays` field. Items with `reminderDays = null` never appear in the Actions widget.

### PerformanceFormat
A named template defining what a musician offers for a specific type of performance engagement. Per-user — seeded from system defaults on first access (on-demand); user-defined formats are a P2 feature.

**Fields:**
- `label` — human-readable name (e.g. "Wedding Ceremony", "Evening Reception", "Solo Piano")
- `category` (optional string) — contextual classifier using the same values as `Booking.eventType`; filters which formats are suggested when creating a booking of that type
- `keyMoments` — `string[]`; moment labels copied into [[MusicFormConfig]] when the format is applied to a booking (e.g. `["Processional", "Signing of the Register (Song 1)", "Signing of the Register (Song 2)", "Signing of the Register (Song 3)", "Recessional"]`)
- `defaultGenreSelection` — `string[]`; genre values enabled by default in [[MusicFormConfig]]; all formats default to Contemporary, Classical, Jazz, Film/TV/Musicals (Bollywood and Christmas excluded)
- `icon` — Lucide icon name (string) for display in the booking creation form and booking detail
- `sets` — ordered list of default [[Set]] definitions (label, duration, order); copied onto the booking as editable `PerformanceSet` records when the format is applied; start times are not set on the format — added at the booking level
- `notes` (optional) — freeform description of the format

**Template + overrides:** applying a format to a booking copies its sets and seeds its `keyMoments` + `defaultGenreSelection` into the booking's [[MusicFormConfig]]. Per-booking edits do not affect the format.

**Relationship to [[Set]]:** every `Set` on a booking is traceable to a `PerformanceFormat` via an optional `performanceFormatId` FK. Ad-hoc sets without a format are not permitted.

**Relationship to [[Booking]]:** a booking has many PerformanceFormats applied (via a `BookingPerformanceFormat` join table with an `order` field). Formats are selected at booking creation via multi-select chips in the creation form; editing (add/remove/reorder) is available on the booking detail page.

**MVP seeded formats (system defaults, per user):**

| Label | Category | Sets | Key moments |
|---|---|---|---|
| Wedding Ceremony | WEDDING | Ceremony, 30 min | Processional, Signing ×3, Recessional |
| Drinks Reception | WEDDING | Drinks Reception, 90 min | — |
| Wedding Breakfast | WEDDING | Wedding Breakfast, 90 min | — |
| Evening Reception | WEDDING | Evening Reception, 45 min × 2 | First Dance |
| Corporate Dinner | CORPORATE | Drinks, 60 min · Dinner, 90 min | — |
| Background Music | — | Background Music, 60 min | — |
| Solo Piano | — | Solo Piano, 60 min | — |

Reminder windows are configured per item in `UserProfile.preferences.checklistDefaults` — no flat `*ReminderDays` columns exist on UserProfile. Adding a new reminder type requires no DB migration.

### Contact Roles (on a Booking)
A Booking has up to three Contact relations, each a separate FK:
- **Customer** (required): the direct payer (e.g. a couple getting married). Rarely repeats.
- **Venue** (optional): the location of the performance. Repeats across bookings; persistent notes (e.g. parking info) live on the Contact record.
- **Booking agent** (optional): the professional third party who sourced the booking — a formal booking agent, a wedding planner acting in that capacity, or similar. Always someone with a commercial role in originating the booking; casual personal referrals are not recorded here. Repeats across bookings.
