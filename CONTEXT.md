# GigMan — Domain Glossary

A CRM for musicians. The central workflow is managing Bookings with Contacts.

**Design principle — booking as epic:** A Booking is a project. Lifecycle stages (Enquiry, Confirmed, Ready, Complete) are the phases of that project. [[BookingChecklistItem]] records are the subtasks within each phase. Stages inform the musician of overall progress; checklist items define the specific work needed to reach each stage. This is the mental model that governs how the checklist, lifecycle, and dashboard interact.

**Design principle — reminders are a Booking property, surfaced per concern:** From the musician's point of view the [[BookingChecklist]] is simply their todo list. The reminder *automation* — auto-complete plus the surfacing that feeds the [[DigestNotification]] and the Dashboard Actions widget — is a property of the [[Booking]], not a list the musician sets out to "configure". They therefore never open a dedicated checklist-configuration screen. Instead each concern (in the [[Booking Builder]] and the new-booking form) carries a "Remind me about" control listing every reminder applicable to that concern — those whose stage the booking has not yet passed, except any the musician has switched off globally in Settings ([[UserProfile]]`.checklistDefaults`) — each toggled on/off for this booking. (Restricting the offer to current-and-future stages also disambiguates an OFF reminder: a current/future one that is off was opted out by the musician and can be turned back on; a past-stage one was retired by the system as the booking advanced and is simply not shown.) On = the corresponding [[BookingChecklistItem]] is on this booking's checklist (being on the list is being reminded — there is no task that is present yet un-reminded; actual nagging is still governed by the cross-booking surfacing filter); off = it is removed (user-initiated SKIP, reversible). Reminder capability is thereby discovered progressively, in context: a newly added reminder type announces itself in the relevant section ("we can now remind you about X") rather than being buried in Settings. The global Settings template remains the master switch (which reminders are ever offered and seeded by default); the per-concern control is the per-booking override. The control surfaces not only system Smart Reminders but also a musician's own **custom items tagged with that concern** (which can be created from it); an untagged custom item stays on the [[BookingChecklist]] card as a plain todo. Each reminder maps to the concern whose work it is about; those with no natural concern fall to Overview (the deal/billing spine and the gig itself) or People (outbound communications — the quote, contract, music-form-invite and thank-you *sends*, grouped as "things sent to a person"). (Surfacing reminder config on the detail-page record cards — Contract, Invoice, Communications — is a possible future extension; for now the home is the Builder and the new-booking form.)

**Design principle — date as first-class anchor:** A Booking's date is identity, not metadata — as load-bearing as its title or customer. Wherever a booking is referenced, its date is surfaced as a calendar-style visual anchor (the tear-off DateBadge: day + month, weekday on the large size only; year and time are never shown). It is placed leading-left as the visual anchor for the row. The badge is **additive emphasis, not a replacement**: the existing full date text stays alongside it on primary surfaces (the booking detail header's second row, the bookings list). Only on the compact dashboard widgets (Actions, Upcoming gigs) does the badge stand alone, replacing the muted trailing date. This is the **one** place GigMan's otherwise-restrained palette permits a deliberate decorative accent — a warm calendar red (`--date-badge`), reserved exclusively for this badge. Status colour continues to encode lifecycle; the date anchor encodes *when* — the two never share a colour.

**Design principle — contextual actions:** The [[BookingChecklist]] is the primary interface for progressing a booking. The happy path is: musician opens a booking, sees what needs doing, and completes it from the checklist without navigating elsewhere. Other panels (Invoices, Communications, Documents) exist for specificity and historical detail — not for primary workflow. Every outstanding checklist item should, where possible, carry an inline action that resolves it in one tap. This is the core differentiator: a smart management system that surfaces the right action at the right time, rather than a passive record-keeper the musician has to manually interrogate. Checklist intelligence is scoped to a single booking — cross-booking awareness (e.g. double-booking detection, band member coordination) is explicitly deferred.

**Design principle — template + overrides:** System-provided defaults (seeded [[Package Template]]s, built-in [[Template]]s, [[UserProfile]] reminder offsets) act as templates. Per-booking configuration is always a copy of that template, editable by the musician without touching the original. Applying a [[Package Template]] creates a booking-owned [[Package]] (a copy) — the template is never linked to the booking. Package Templates are fully user-customisable; further customisation of templates and other user-defined defaults is a P2 concern.

**Design principle — the Itinerary is one concern; packages group within it:** A booking's performance is built from canonical [[Set]] records — each owns its time, duration, label and order. To the musician this is simply **the Itinerary**: the running order of the day. [[Package]]s are a **non-binding grouping convenience** *within* the itinerary — a labelled, icon-bearing container with no teeth (not a billing unit, no hierarchy, no behaviour of its own) — and the same grouping vocabulary also sections the [[MusicFormConfig]] key moments (likewise canonical, owned by the music form). The booking fee is authoritative and invoice line items are free-form; packages never bill. There is **one admin surface**: the Itinerary, where sets, the packages that group them, their times and their order are read and edited together (sets may be ungrouped). The itinerary also owns the operational **time anchors** — arrival, sound check and finish — interleaving them with sets into a single running-order timeline **in the read views (the detail-page Itinerary card and the client [[Portal]]): the anchors bookend and interleave the chronological day, and a [[Package]]'s name leads each contiguous run of its sets. The *edit* surface presents the same one concern grouped by package rather than by strict chronology — a times block plus one box per package (and an ungrouped box) — because a package's sets need not be time-contiguous, so grouping is the only arrangement in which each set's controls (and "add a set here") have a home; a set re-parents between packages in place. Read interleaves by time, edit groups by package — both are the single Itinerary concern.** The *non-temporal* logistics (dress code, performance space, food, green room, equipment, custom fields) are a separate **On the Day / Details** concern (the rule: *temporal goes in the itinerary, conditions go in details*). The time anchors remain stored in the `logistics` JSON, so the itinerary surface edits two backing stores behind one timeline — an implementation seam, not a user-facing one. The former separate **"Performance"** card/umbrella is retired — usability testing showed musicians do not perceive a "Performance" concept sitting above the itinerary; they experience themselves as editing the itinerary directly. The only *other* rendering is the client [[Portal]], which presents the same sets as named segments (using the package groupings) without operational chrome. The earlier rule that itinerary and packages are "two lenses that must not be conflated" described the now-retired teeth-ful Package; with packages defanged (ADR-0046) the itinerary and its grouping are a single concern, and this principle supersedes it. See ADR-0050.

**Design principle — enums for closed lifecycles only:** Use Prisma enums for states that are genuinely exhaustive domain constants (e.g. `BookingStatus`, `InvoiceStatus`). Avoid them for extensible classifier fields (event categories, genres, format types) — store those as validated strings instead. Adding a new value to an extensible enum requires a DB migration and cascading code changes; a constants list requires only a deploy.

**Design principle — mobile space is a scarce resource:** Mobile layouts treat screen space as valuable currency. Concrete implications: hide cards and sections that have nothing to show (`hideWhenEmpty`); use tabs to give each concern its own breathing room rather than stacking everything into one long scroll; compress information density (e.g. `PersonChip` over `PersonCard`) when space is at a premium. The goal is that the content most relevant to the musician's current moment is reachable without scrolling — not that all content is always visible. See ADR-0037 for how this principle is applied on the booking detail page.

**Design principle — feature components as self-contained units:** Components in `features/` own whatever is tightly scoped to them, using hooks as escape hatches to access shared state directly — TanStack Query for data, `useSearchParams` for sheet dispatch. A parent never passes down computed values or domain data that a child could reach itself; TanStack Query deduplicates reads so the same hook can be called in multiple components without double-fetching. Layout decisions — including breakpoint-driven conditional rendering — belong in the parent. Components render unconditionally; the parent decides when and whether to mount them. A container's remaining jobs are: (1) the loading/error gate for the page, and (2) orchestrating mutations that require genuine coordination between sibling components.

**Design principle — discoverability is in-context and self-pruning:** The conceptual model is taught at the moment of confusion, on surfaces that already exist — never via a product tour, a tooltip layer, or a help centre (a hover-driven tour is wrong for a mobile-first app, and front-loaded teaching is clicked through once and forgotten). Onboarding collects the minimum data the app needs to work and otherwise *orients and activates* rather than configuring (see [[OnboardingFlow]]); it is not a concept course. The two reinforce each other: a gap a musician skips at onboarding becomes a Category-1 precondition the tips widget nudges later.

What needs surfacing falls into two categories, distinguished by whether the "done" state is *detectable* — and that detectability dictates the delivery mechanism:

- **Feature completeness (detectable done-state).** A value the user hasn't set has implicitly switched a feature off — no home address → no travel time; no logo → unbranded portal; no custom packages → generic defaults. Whether it's done is an objective data check, so it self-prunes. → **Tips widget.**
- **Learning how it works (no detectable done-state).** Understanding a concept or not being surprised by behaviour — stages don't auto-advance; issuing an invoice locks it. There is no way to query "has the user understood this," so it cannot self-prune on state; it uses dismiss-once or lives permanently at the action. → **Concept card** (big mental models) or **inline at the action point** (small surprises). Never the tips widget — its self-pruning engine has nothing to test.

Delivery surfaces:

1. **Concept card** — a genuinely hard *mental model* gets a single one-time, dismissable inline card **at the concept's home screen**, on first contact. The canonical case is the booking-as-epic model (lifecycle stages are a manual readiness assessment; the checklist is the work that gets you there), taught by one card on the booking detail page. Recallable afterwards via a quiet "How this works" link in the relevant section header. Concepts are taught where they live, never on a separate screen, and never in the tips widget.
2. **Inline at the point of use** — two things live here. (a) Small behavioural surprises (Category 2) are handled by warnings/confirmations right where the action happens (the issue-invoice warning, the status-change confirmation dialog) — many already exist; extend them rather than invent a surface. (b) **Inline hints** — a small, actionable, in-context prompt ("Add your home address to see travel time →") shown *where a feature-completeness gap (Category 1) would otherwise silently render nothing*. The travel-time prompt in the venue map widget is the canonical inline hint and the first instance of this reusable pattern. The same Category-1 gap may also surface as a tips-widget tip on the dashboard; the two are complementary — point-of-use vs aggregated nudge — drawing on the same completeness predicates.
3. **Empty states** — a feature's single core idea is taught at first contact within the existing empty-state shape (icon, heading, *one* paragraph, one CTA — nothing more). This is for "what is this feature for," not deep concepts.
4. **Tips widget** — a dashboard widget for *feature completeness* (Category 1 only; never concept teaching). It surfaces one **targeted** pointer at a time: each tip carries a precondition evaluated against the user's actual state, so only applicable, not-yet-dismissed tips are eligible; the shown tip rotates among the eligible pool on each load. Dismissal is permanent (stored in `UserProfile.preferences.dismissedHints` — a single namespace shared with concept-card dismissals; tip and card IDs coexist). The widget is self-pruning — it `hideWhenEmpty` once the eligible pool is exhausted, so it is a fading scaffold for new users, not a permanent fixture. The tip pool is a small curated static list, each `{ id, condition, text, href }`.

---

## Terms

### Booking
The central entity. Represents a performance engagement — confirmed or in-progress. Connects a Contact to a body of work (sets, song list, documents, communications).  There is no separate concept of "Gig"; Booking covers the full lifecycle of a performance engagement.

**Lifecycle (ordered):** `Enquiry → Provisional → Confirmed → Ready → Complete` (plus `Cancelled` at any point). See ADR-0018.

The lifecycle represents the musician's genuine assessment of readiness — not a record of which tasks have been completed. [[BookingChecklistItem]] tasks inform that assessment via the status-change confirmation dialog (which lists outstanding required items if any exist), but the musician always advances status manually. No status transition is mechanically triggered by task completion. The status dropdown does not show outstanding item counts inline — the dialog advisory is the only mechanism for this signal. The dialog is also the intended **last notice** that advancing will stop reminders: any outstanding item being *left behind* (its `requiredForStatus` is a stage the booking is about to move past) drops off the Dashboard Actions widget and [[DigestNotification]] once advanced — see the cross-booking surfacing filter under [[BookingChecklist]]. (The dialog currently lists only items required for the stage being *entered*; warning about the left-behind set is intended but not yet implemented.)

- *Enquiry*: initial interest, quote not yet sent or accepted. Its full value arrives with the P2 email ingestion feature, which will create Enquiry-stage bookings automatically from inbound emails. Enquiry bookings are excluded from the dashboard calendar and Upcoming Gigs widget — they are not committed enough to occupy a date slot.
- *Provisional*: the client has agreed the quote in principle — the musician has sent a quote and the client has said yes. Formalities (contract, deposit) are still outstanding. This is the standard entry point for most bookings in practice: the musician creates the booking once verbal agreement is reached. The portal is accessible at this stage. Status pill colour: blue.
- *Confirmed*: the engagement is locked in — contract signed and deposit received. The musician moves here manually; `requiredForStatus: CONFIRMED` checklist items (contract signed, deposit received) provide the advisory gate.
- *Ready*: all pre-gig preparation is done — balance invoiced, music form in, logistics resolved. The musician moves here manually when they feel genuinely prepared. Status pill colour: purple.
- *Complete*: post-gig admin is done — thank you sent, any outstanding items resolved. The musician moves here manually.
- *Cancelled*: booking cancelled at any point in the lifecycle. The portal remains accessible (token still valid); a cancellation notice is shown. The [[BookingChecklist]] is hidden for cancelled bookings.

**Pre-confirmation tracking:** two nullable timestamp fields — `contractSignedAt` and `depositReceivedAt` — record when each arrived.

`depositTrackingMode` has been removed. `depositReceivedAt` is now set by two paths, in priority order:
1. Automatically when the deposit [[Invoice]] is marked Paid.
2. As a side effect when the musician marks the `deposit_received` [[BookingChecklistItem]] COMPLETE — set to the current timestamp at that moment.

`depositReceivedAt` records when the deposit actually arrived — this is distinct from the checklist item being marked complete, which may happen at a different time. **P2:** allow the musician to enter the actual received date/time directly (e.g. when they receive a bank transfer and want to record the exact date). For now, the timestamp is always "now" at the point of the action that triggers it.

`depositReceivedAt` is not directly patchable via the booking update endpoint. It is a derived timestamp owned by the deposit flow.

Status transitions are not enforced by the API — a Booking can move freely between any statuses.

**Top-level fields:**
- **status**: see lifecycle above; defaults to PROVISIONAL on creation
- **date**: the date (and optionally time) of the performance
- **title** (optional): human-readable label; useful when the booking is for a named event (e.g. a festival) not easily derived from the customer name
- **fee**: the agreed total amount (Option A — independent of invoice line items; represents what was verbally agreed, used in the contract)
- **notes** (optional): freeform internal notes for the musician
- **eventType**: string — one of `WEDDING | CORPORATE | PRIVATE | RESIDENCY | FESTIVAL | OUTDOOR | FUNCTION | OTHER`; a display classifier and filter axis; stored as a plain string (not a Prisma enum), validated in application code; decoupled from [[Package]] behaviour
- **customerId** (required FK → Contact)
- **venueId** (optional FK → Contact): venue address/info lives on the Contact record, not duplicated
- **bookingAgentId** (optional FK → Contact)
- **travelMode** (optional String — `'DRIVING'` | `'TRANSIT'`): per-booking override for travel mode when calculating travel time to the venue. Null means use the musician's global `UserProfile.preferences.defaultTravelMode`. Driving-only for MVP; field reserved for when transit support ships.
- **logistics** (optional JSON — see ADR-0034): all "on the day" operational fields in a single column. Keys are either system-defined (`arrivalTime`, `soundCheckTime`, `finishTime`, `dressCode`, `performanceSpace`, `foodProvided`, `greenRoom`, `equipmentRequired`) or user-defined custom fields. Each entry has the shape `{ value: string; icon?: string; notes?: string; shareWithBand: boolean; shareWithClient: boolean }`. Custom entries additionally carry `label: string`; their key is machine-generated (`customField1`, etc.). Both sharing flags default to `false`. System field display labels are derived from the key via a constants map; custom field labels are stored in the entry. The `notes` field is optional on any entry; the three time fields (`arrivalTime`, `soundCheckTime`, `finishTime`) use it for supplementary notes displayed as a sub-label beneath the time row in the Itinerary card (e.g. "Gate closes at 9"). Notes share the same `shareWithBand`/`shareWithClient` flags as their parent entry. Time field values are constrained to HH:MM format (enforced via `<input type="time">`).
- **contracts**: zero-to-many [[Contract]] entities; at most one is in a non-VOID state at any time
- **sets**: ordered list of [[Set]] entities
- **songList** (optional): song requirements for the booking — deferred to [[song-library]] feature

### Active pipeline
The default scope of the bookings list: [[Booking]]s whose status is one of `ENQUIRY`, `PROVISIONAL`, `CONFIRMED`, or `READY` — the live, in-flight work. Complete and Cancelled bookings are *not* in the active pipeline; they remain fully searchable but are excluded from the resting list view so it stays useful day-to-day. The leftmost bookings-list tab is labelled **"Active"** and selects this scope; there is deliberately no "all bookings" tab. Searching or applying a filter from the default lifts the scope to *all* statuses (so any booking is findable) and clears the "Active" highlight; explicitly choosing a status tab re-constrains. See ADR-0041.

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
- email, phone, notes
- **Address (structured):** `addressLine1`, `addressLine2`, `city`, `county`, `postcode`, `country` (default `"GB"`), `latitude` (Float), `longitude` (Float), `placeId` (Google Places ID — stored for future route/mileage lookups). All nullable. Populated via Google Places Autocomplete at entry time. The freeform `address` field has been replaced by these columns.
- **primaryRole** (optional string — one of `CUSTOMER | VENUE | BOOKING_AGENT`): the role this contact most commonly plays. Surfaced in the UI as **"Contact Type"** (not "primary role") — from the user's point of view it is simply what kind of contact this is; the non-binding nature is an implementation detail they should not have to reason about. Used to pre-populate the correct field when creating a booking from their detail page, and to show a role badge in contact lists and detail views. Stored as a plain string (not a Prisma enum) — validated in application code against the constants list. A contact can still appear in any role on any booking regardless of `primaryRole`; this is a hint for the UI, not a constraint. When creating a contact inline from a booking slot, Contact Type is pre-filled from that slot but remains overridable (the slot is a per-booking role; Contact Type is the contact's usual type — they usually coincide but need not).
- *Venue extras:* parkingInfo, accessInfo, equipmentAvailable
- *Booking agent extras:* website, commissionArrangement (freeform text)
- **Travel time cache (venue contacts):** `travelTimeMinutes` (Int?), `travelDistanceMetres` (Int?), `travelTimeCalculatedAt` (DateTime?), `travelMode` (String? — the mode the cached result was calculated for; defaults to `'DRIVING'`). Lazily populated by the backend on first page visit that shows the venue map widget. Invalidated when this Contact's address changes, or when the musician's home address changes (all venue Contacts cleared). Refreshable via a manual button on the map widget.

All fields live on the Contact table as nullable columns — no sub-type tables. A Contact can serve as both a venue and a booking agent on different Bookings; the extra fields are always available regardless of role.

### Set
A scheduled performance slot within a Booking — *optionally* grouped under a booking-owned [[Package]], or **ungrouped** (no package). Multiple Sets form the running order for the day and constitute the performance schedule in the contract. Fields:
- **duration** (required): length in minutes (e.g. 45)
- **startTime** (optional): the time the set begins (e.g. 14:00) — set at the booking level; not on the format template
- **label** (optional): occasion name (e.g. "Ceremony", "Drinks Reception")
- **order** (required): integer used to preserve sequence when start times are absent
- **packageId** (optional FK → booking-owned [[Package]]): the Package this set is grouped under; **null means ungrouped**. Used to group sets by package in the UI; ungrouped sets render flat (no heading).

Sets are created by applying a [[Package Template]] to a booking — which creates a booking-owned [[Package]] and copies the template's default slots into it as editable Set records. Sets can also be added **directly to the booking without any package** (`packageId` null) — grouping is encouraged but never enforced (a plain "four sets, no segmentation" gig needs no container). There is no invisible/implicit container for ungrouped sets — `null` is the representation (see ADR-0046). Song requirements within a Set (must-haves, don't-plays, special roles) are deferred to the Song Library feature.

### Invoice
A financial document issued to a Contact for a [[Booking]] or a [[BookingSeries]]. A Booking can have multiple Invoices (e.g. a deposit invoice followed by a balance invoice, or a single full invoice — the musician decides). Has many [[InvoiceLineItem]]s.

**Ownership:** an Invoice belongs to either a Booking (`bookingId` set, `seriesId` null) or a BookingSeries (`seriesId` set, `bookingId` null). Exactly one must be set — enforced at the application layer. See ADR-0029.

**Status:** `Draft | Issued | Sent | Paid | Void` (stored). *Issued* means the invoice is **finalised** — assigned its invoice number, issue/due dates set, line items locked, and PDF generated and stored as a [[Document]] — but **not yet delivered** to the client. *Issuing* (committing the document) and *sending* (delivering it) are deliberately distinct acts: an invoice can be Issued and then downloaded and sent by hand, without ever using the app's send infrastructure. See ADR-0042. *Overdue* is derived — not a stored state — inferred when status is `Sent`, a due date is set, and that date has passed (an Issued-but-undelivered invoice past its due date is **not** overdue). A Void invoice is preserved for history but no longer active; a new invoice can be created on the same booking or series after voiding.

An Issued invoice is delivered in one of two ways: (1) **Send** — the app emails the *already-stored* invoice PDF via Resend using the appropriate cover template (the PDF is reused, never regenerated) and marks it `Sent`; (2) **Mark as sent** — marks it `Sent` without sending an email, for invoices communicated outside the app. A `Draft` is freely editable and reversible; **issuing is a committing action** (the musician is warned), after which line items are locked — to change an issued invoice the musician voids it and creates a new one.

**Fields include:** invoiceNumber (nullable — null until issued; format derived from `UserProfile.preferences.invoiceNumberFormat` (default `INV-{year}-{NNN}`); assigned at **issue** time by either incrementing `UserProfile.invoiceNumberSequence` or, if a VOID invoice of the same type already exists on the booking, inheriting its number — see ADR-0028), issueDate (nullable — null until issued, defaults to today at issue time), dueDate (nullable — null until issued, defaults to `issueDate + UserProfile.defaultPaymentTermsDays` if set), status, isDeposit (boolean, default false — at most one non-VOID invoice of each type per booking, enforced at the API level; 409 if a non-VOID invoice of the same `isDeposit` value already exists on creation), and a reference to which Contact it is addressed to (defaults to the Booking's customer or the [[BookingSeries]] customer but may differ). When `isDeposit` is true and the invoice is marked Paid, `Booking.depositReceivedAt` is automatically set.

**Series invoices:** `isDeposit` is always false for series invoices — the deposit/balance concept belongs to single-booking project invoicing only. The constraint is "at most one non-VOID invoice per series" (no type distinction). Line items are auto-generated at creation: one line per member [[Booking]] (date + sets description + booking fee as amount), pre-populated and fully editable. Each auto-generated line **traces to its source member Booking**; while the series invoice is a `Draft` it stays in sync with series membership (a booking added or removed adds or removes its line, leaving manual edits and custom lines untouched). Once the series invoice is `Issued` the billing batch is **closed**: membership changes are blocked until it is voided. See ADR-0043.

**Draft state:** a draft invoice has no invoiceNumber, issueDate, or dueDate. These display as "—" in the UI.

**Balance invoice PDF rendering:** when generating the balance invoice PDF, derive the deposit amount at render time from the deposit [[Invoice]]'s line item total (isDeposit=true). Show a breakdown: subtotal, less deposit paid, balance due. Only show this section if a deposit Invoice exists on the booking. Do not add a stored field for this.

### InvoiceLineItem
A line on an [[Invoice]]: description (text) + amount (decimal).

**First line item — service description:** when an invoice is created, the first line item description is pre-populated from the booking's performance formats and sets (e.g. "Wedding Ceremony (30 min), Drinks Reception (90 min), Evening Reception (45 min × 2)"). This gives clients the service detail they typically request. The amount defaults to the booking fee (or deposit percentage for deposit invoices). The description is fully editable — pre-population is a convenience, not a constraint.

**Additional line items:** free text for anything beyond the core service — travel, equipment hire, accommodation, etc. No fixed categories.

**Series lines trace to a booking:** on a [[BookingSeries]] invoice, each auto-generated line records which member [[Booking]] it came from, so a draft series invoice can be reconciled against series membership (see [[Invoice]] → Series invoices, ADR-0043). Lines added by hand have no such trace and are never touched by reconciliation.

### BookingSeries
A billing grouping for a set of related [[Booking]]s that are invoiced together — typically a residency (a regular slot at a venue billed at the end of a billing period). See ADR-0029.

**Principle — series as billing batch:** a series represents one billing period, not an ongoing residency entity. Bookings in a different billing period form a separate series. The series has no dedicated UI page; it surfaces contextually within the [[Booking]] detail page.

**Fields:**
- `label` — human-readable name (e.g. "Hotel Intercontinental — May 2026"); required
- `customerId` FK → [[Contact]] — the billing contact; authoritative source for who the series [[Invoice]] is addressed to

**Membership:** a Booking joins a series via `Booking.seriesId` (nullable). Membership can be set at booking creation or retroactively, with two guards on retroactive assignment: (1) the booking must have no non-VOID invoices (409 with an explanation if it does); (2) if the booking's `customerId` differs from the series `customerId`, the API returns a warning — the musician must explicitly confirm, since the series invoice will be addressed to the series customer regardless. The booking's own `customerId` is never modified by series assignment. A booking can only belong to one series.

**Series lifecycle:** derived from the Invoice — no stored status. No invoice → open/unbilled. Draft invoice → billing in progress. Sent or Paid → billed. Void → back to open.

**No series contract:** residency arrangements are informal or handled through booking agencies. Contract ownership stays per-Booking; series member bookings typically carry no contract checklist items.

**New booking pre-population:** when the musician selects an existing series in the booking creation form, venue, booking agent, and checklist items are pre-populated from the earliest member booking in the series (ordered by `createdAt`), and customer from `series.customerId`. All pre-populated values are editable before saving. **Performance packages and the [[MusicFormConfig]] are *not* pre-populated:** a booking-owned [[Package]] is an independent snapshot with no provenance back to a [[Package Template]] (ADR-0046), so a prior member's packages cannot be reconstructed at creation time.

**Invoice section in booking UI:** the Invoice section on any member Booking's detail page shows the series invoice as a variant ("Series Invoice") — creation and edits carry a reminder that changes affect the whole series.

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

**Business fields (explicit columns):** `addressLine1`, `addressLine2`, `city`, `county`, `postcode`, `country`, `latitude` (Float?), `longitude` (Float?), `placeId` (String?) — structured address replacing the former freeform `address` field; populated via Google Places Autocomplete; used as the travel time origin for the venue map widget. Also: bankDetails (encrypted at rest — see ADR-0003), vatNumber, defaultPaymentTermsDays, invoiceNumberSequence, invoiceSequenceYear, depositPercentage (nullable integer 1–100 — the default deposit % of the booking fee; null means no default set), digestEmailEnabled, songRequestFormEnabled, onboardingCompletedAt (nullable timestamp — null until the musician completes or skips all [[OnboardingFlow]] steps; used as the gate for admin access). `depositTrackingMode` has been removed — deposit tracking is now fully handled by the [[BookingChecklistItem]] model. `songRequestFormEnabled` remains a column but is surfaced in **Booking settings → General** (not Notifications).

**`preferences` (JSON column):** all workflow and behaviour preferences, gated by subscription tier at write time. See ADR-0015. Contains:
- `checklistDefaults` — the musician's default [[BookingChecklistItem]] template; an ordered array of item definitions (key, label, completedBy, dependsOn, autoCompleteRule, requiredForStatus, dueDateRule, enabled). Seeded from system defaults on first access. The system defaults represent the current 12-item workflow. System items carry a `key` and may be disabled (`enabled: false`) — disabled items are not seeded into new bookings, and any `dependsOn` references to missing items are stripped at seeding time. Custom items (no `key`) are always enabled and can be appended.
- `defaultBookingStatus` — `'ENQUIRY' | 'PROVISIONAL' | 'CONFIRMED'`; the status pre-filled in the new booking form. Default: `'PROVISIONAL'`. A musician who creates bookings only after the contract and deposit are already done outside the app would set this to `'CONFIRMED'` — items for earlier stages are not seeded. Stored in `UserProfile.preferences`; surfaced in **Booking settings → General**.
- `reminderLeadDays` — global integer; how many days before an item's `dueDate` it starts surfacing in the [[DigestNotification]] and Dashboard Actions widget (e.g. 7 = surface tasks in the 7 days leading up to their due date). Default: 7. Replaces the former flat `*ReminderDays` columns and per-item `reminderDays` field.
- `invoiceNumberFormat` — controls how invoice numbers are generated: `{ prefix: string (default "INV", may be empty), includeYear: boolean (default true), paddingWidth: 1 | 3 | 4 | 6 (default 3) }`. Parts are joined with `-`; empty prefix is omitted. Examples: default → `INV-2026-001`; prefix "MUSIC", no year, 4 digits → `MUSIC-0001`; no prefix, no year, 3 digits → `001`. Year inclusion and annual reset are coupled: `includeYear: false` makes the sequence continuous (never resets); `includeYear: true` resets the counter each January.
- `customDressCodeOptions` — `string[]`; user-added values for the dress code select. System defaults (`Smart Casual`, `Formal`, `Black Tie`, `Morning Dress`, `Casual`, `Cocktail`) live in `constants.ts`; user additions are appended here and merged with system defaults at render time.
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

**Seeding:** the [[SeedCatalogue]] (a static file derived from the existing `mick-form` song list, not a DB table — there is no global song pool) is a *search source* for adding individual songs. A musician searches it and adds the songs they actually play, which are created as Song records with their `userId`. There is no bulk/genre opt-in: adding a whole genre blindly would fill the library with songs the musician does not play (anti-confidence + an audit chore). The same add-from-catalogue mechanic powers the Repertoire page and the onboarding "add your first song" activation (see [[OnboardingFlow]] step 5).

### Genre
A string value categorising Songs: `CONTEMPORARY | CLASSICAL | JAZZ | FILM_TV_MUSICALS | BOLLYWOOD | CHRISTMAS`. Stored as a plain string (not a Prisma enum) — new genres can be added without a DB migration. Validated in application code against a constants list. Managed at the system level — musicians cannot add custom genres for MVP.

### BookingChecklistItem
A stored action item on a [[Booking]], representing something that needs to happen to progress or complete the booking. Together the items form the booking's checklist — a project management-style task list that surfaces the right action at the right time. See ADR-0016.

Items are **seeded at booking creation** from the musician's `checklistDefaults` template in [[UserProfile]]`.preferences` (system defaults on first use). Each item is an independent DB record with stored state — never computed at read time.

**Fields:**
- `key` — string identifier for system items (e.g. `create_contract`, `contract_signed`); null for user-defined custom items
- `label` — display label; system items have a default, custom items are user-defined
- `completedBy` — `USER | CUSTOMER | BAND_MEMBER`; declares which actor resolves this item
- `state` — `PENDING | COMPLETE | FAILED | BLOCKED | SKIPPED`
- `order` — integer preserving display sequence
- `dependsOn` — `string[]`; keys of items that gate this one in the UI (BLOCKED until all named items are COMPLETE). This is a workflow sequencing hint — it makes the checklist more contextual and reduces noise by hiding downstream items until the right moment. It is not a hard prerequisite: if a depended-upon item was not seeded (because the musician disabled it in their defaults), the BLOCKED state is simply skipped and the item starts as PENDING. A dependency that is **SKIPPED** is likewise treated as non-blocking (equivalent to absent): opting a reminder out post-creation sets it SKIPPED, and this must never strand its downstream items in BLOCKED. The musician can always manually override any state regardless of `dependsOn`.
- `autoCompleteRule` — optional JSON; when present, the system evaluates the rule on relevant business events and sets state to COMPLETE automatically. When absent, the item is manual-only. Rule types: `bookingField` (complete when a named Booking field is non-null), `communicationSent` (complete when a SENT Communication of a given template type exists), `invoiceExists` (complete when an invoice of the given kind exists), `musicFormResponse` (complete when a MusicFormResponse exists). The musician can always manually override the state of any item regardless of whether an `autoCompleteRule` is present — the rule assists, it does not dictate. COMPLETE is sticky: the evaluator will not revert a manually-completed item.
- `requiredForStatus` — optional `BookingStatus`; advisory association — the UI warns the musician if they attempt to advance the booking to this status while this item is PENDING or FAILED, and prompts them to advance when all items for this status become COMPLETE. The API does not enforce this gate.
- `completedAt` — timestamp set when state transitions to COMPLETE
- `dueDate` — optional absolute DateTime; when this task should be done. Computed at seeding time from `dueDateRule` + the booking's relevant date. Overrideable by the musician; clearing the override restores rule-based calculation. Items without a `dueDate` do not surface in the [[DigestNotification]] or Dashboard Actions widget except when they are the last PENDING/FAILED item gating a `requiredForStatus` transition. Note the stage gate takes precedence on those surfaces: a dated item still does **not** surface there once its `requiredForStatus` stage has been passed (see the cross-booking surfacing filter under [[BookingChecklist]]). Displayed inline on the checklist row using a hybrid format: relative ("today", "tomorrow", "in 3 days", "2 days ago") when within 7 days of today; absolute ("15 Jun") beyond that. Colour: muted by default; amber when within `reminderLeadDays` of the due date; red when overdue.
- `dueDateRule` — optional JSON: `{ basis: 'bookingDate' | 'bookingCreation', offsetDays: number }`. The rule used to compute `dueDate` at seeding time. When null, `dueDate` is manually set (or absent). When the booking date changes, all non-completed items with `basis: 'bookingDate'` have their `dueDate` recomputed. `offsetDays` is negative for "before booking date" (e.g. -14 = 14 days before) and positive for "after booking creation" (e.g. 3 = 3 days after creation).

**States:**
- **PENDING** — not yet done, applicable, unblocked
- **COMPLETE** — completed (auto or manual); shown with a tick
- **FAILED** — a system action associated with this item was attempted and failed (e.g. email send failed); shown with a warning
- **BLOCKED** — one or more `dependsOn` items are not yet COMPLETE; shown as inactive
- **SKIPPED** — was applicable but is no longer relevant (e.g. booking advanced past the point where this item applied); hidden from the active checklist

Items in the FAILED state: (1) the warning triangle is clickable — clicking it resets the item to PENDING; (2) shortcut buttons (Send, Create, Mark done) remain visible on FAILED items with the action label prefixed with "Retry " (e.g. "Retry Send", "Retry Create"). COMPLETE items: clicking the tick resets the item to PENDING. The `play_the_gig` item is visually distinguished on the checklist (Lucide `Sparkles` icon instead of the standard circle/tick; a `canvas-confetti` burst fires when it is marked COMPLETE — this is the most important moment in the booking lifecycle). It is reversible like all other items.

**Ad-hoc items:** the checklist section's contextual action (in the section header, consistent with other section CTAs) is "+ Add item". This opens an inline form to add a one-off [[BookingChecklistItem]] to this booking only — no `key`, no `autoCompleteRule`, the musician sets the label, optional `requiredForStatus`, and optional due date. Does not affect the musician's template in [[UserProfile]] preferences.

**New booking checklist step:** after filling in the booking details form, the musician sees a checklist customisation screen before the booking is created. The screen shows all default items from the booking's starting stage onwards (items from stages before the selected status are excluded, per the seeding rule). The musician can: toggle any item off (it won't be seeded), toggle any item back on, or add custom one-off items. Confirming this screen creates the booking and seeds the final item set in a single operation. The `checklistItems` array is a required field on `POST /bookings` — the server always seeds exactly what the client sends, never auto-derives from the template. The frontend fetches the musician's defaults from `GET /me` (`preferences.checklistDefaults`), filters by starting stage, and sends the final set (after any musician customisation) in the creation payload. The checklist is hidden entirely for CANCELLED bookings. CUSTOMER-completedBy items (e.g. contract signed, music form submitted) are resolved by portal actions — their `autoCompleteRule` fires when the corresponding booking field is set. COMPLETE items are hidden from the active checklist by default; a "Show X completed items" control reveals them.

**System item keys and their auto-complete rules:**

| Key | completedBy | autoCompleteRule | requiredForStatus | dueDateRule | dependsOn |
|---|---|---|---|---|---|
| `send_quote` | USER | communicationSent: quote | PROVISIONAL | bookingCreation +2 | — |
| `confirm_quote` | USER | — (manual) | PROVISIONAL | — | send_quote |
| `create_deposit_invoice` | USER | invoiceExists: isDeposit=true | CONFIRMED | — | confirm_quote |
| `create_contract` | USER | bookingField: activeContract | CONFIRMED | — | confirm_quote |
| `send_contract` | USER | communicationSent: contract_cover \| contract_and_deposit_cover | CONFIRMED | bookingDate −60 | create_contract |
| `contract_signed` | CUSTOMER | contractSigned | CONFIRMED | bookingDate −45 | send_contract |
| `deposit_received` | CUSTOMER | bookingField: depositReceivedAt | CONFIRMED | bookingDate −30 | send_contract |
| `create_balance_invoice` | USER | invoiceExists: isDeposit=false | READY | bookingDate −14 | — |
| `music_form_invite` | USER | communicationSent: music_form_invite | READY | bookingDate −30 | — |
| `song_requests` | CUSTOMER | musicFormResponse | READY | bookingDate −14 | music_form_invite |
| `play_the_gig` | USER | — (manual) | COMPLETE | bookingDate ±0 | — |
| `send_thank_you` | USER | communicationSent: thank_you | COMPLETE | bookingDate +7 | play_the_gig |

**Checklist seeding rule:** items belonging to stages before the booking's creation status are not seeded. Stage order for seeding purposes: `Enquiry → Provisional → Confirmed → Ready → Complete`. A booking created at PROVISIONAL skips ENQUIRY-stage items (`send_quote`, `confirm_quote`). A booking created at CONFIRMED skips ENQUIRY and PROVISIONAL items — the checklist starts at READY prep. This means `dependsOn` chains are never broken by missing items: all seeded items have their dependencies also seeded.

### Smart Reminder
A **system-authored** [[BookingChecklistItem]] — one with a `key`, defined by GigMan in the checklist defaults, not by the musician. What separates it from a musician's own custom item is that **GigMan completes and sequences it for you**: a Smart Reminder **auto-completes** via an `autoCompleteRule` and may be **sequenced** behind other items (`dependsOn`) — capabilities only the system can author. It is also **staged** to a lifecycle phase (`requiredForStatus`) and **mapped to a concern** (so it surfaces in that concern's "Remind me about" control — see the *reminders are a Booking property* design principle), but staging and concern-mapping are **not** exclusive to Smart Reminders: a custom item may carry both too. The musician can enable or disable a Smart Reminder — globally in Settings, or per booking — but cannot author one or change its behaviour.

By contrast a **custom item** (no `key`, the "+ Add item" path, or authored in the Settings template for all future bookings) is **free-authored but inert**: it never auto-completes and is never sequenced — those are the system's province. It may, however, carry an optional due date, an optional stage, and an **optional concern**. A concern-mapped custom item surfaces in that concern's "Remind me about" control alongside the Smart Reminders (and can be created from there); a concern-less custom item lives only on the [[BookingChecklist]] card as a plain todo. This is what gives a musician's **global** custom reminders a home in the per-concern surface — tag the template item with a concern and it appears in that section on every booking.

Note the line between a Smart Reminder and a custom item is **auto-completion and sequencing** (only the system authors those) — *not* concern-mapping or staging, which a custom item may also have, and *not* the dependency chain specifically (some Smart Reminders carry no `dependsOn` at all — `add_venue`, `build_itinerary`, `create_balance_invoice`).

**User-facing naming is parked:** "Smart Reminder" is an internal term for now. Whether and how to surface it to musicians — e.g. to explain why an item auto-ticked, or why one is gated behind another — is deferred (the value would be teaching the behaviour at the moment it surprises, per the [[#477]] in-context-teaching spirit).

### BookingChecklist
The ordered collection of [[BookingChecklistItem]] records for a given [[Booking]]. Not a separate model — a logical grouping term. Displayed on the Booking detail page; outstanding items feed the [[DigestNotification]] and Dashboard Actions widget.

**Default filter — single-booking view:** items are grouped by `requiredForStatus` and rendered with a stage divider (label + colour matching the booking lifecycle stage). The default view shows only the current stage group and the next stage group; BLOCKED items are always hidden in the default view. COMPLETE items within visible stage groups are shown — they provide stage-level progress context. Custom items with no `requiredForStatus` appear at the top in an unlabelled group. A "Show all" control reveals all groups and BLOCKED items. Stage divider labels use the canonical booking status label: "Confirmed", "Ready", "Complete" (matching the status pill labels already used in the UI).

Stage visibility by booking status:
- ENQUIRY → PROVISIONAL group only (no items have requiredForStatus: ENQUIRY)
- PROVISIONAL → PROVISIONAL + CONFIRMED groups
- CONFIRMED → CONFIRMED + READY groups
- READY → READY + COMPLETE groups
- COMPLETE → COMPLETE group only
- CANCELLED → checklist hidden entirely

**Sort order — single-booking view (Booking detail page):** `order` ascending within each group. This preserves the workflow narrative (contract → deposit → balance invoice → music form…) and is stable regardless of dates.

**Sort order — cross-booking surfaces (Dashboard Actions widget, [[DigestNotification]]):** `dueDate` ascending; undated items appear after dated items. Surfaces the most urgent items first across all bookings.

**Surfacing filter — cross-booking surfaces (Dashboard Actions widget, [[DigestNotification]]):** these action-oriented surfaces show only outstanding (PENDING/FAILED), USER-completedBy items (CUSTOMER-completedBy passive waits are omitted), narrowed by three rules. This is a **single rule, owned by the API and shared by both surfaces** — they must never diverge from each other:

1. **Stage gate:** drop any item whose `requiredForStatus` is a lifecycle stage the booking has already *passed* (e.g. a CONFIRMED-stage `deposit_received` on a booking that is now READY or COMPLETE). Once the musician advances the booking past a stage, that stage's requirements are water under the bridge and stop nagging — mirroring the single-booking view, which hides past-stage groups. **Consequence:** unlike the detail page, these surfaces have no "Show all" escape hatch, so a genuinely-skipped task goes silent here once the booking moves past its stage. The status-change confirmation dialog (see [[Booking]]) is the intended safety net: at the moment of advancing it should warn that any outstanding item being *left behind* (one whose `requiredForStatus` the booking is about to move past) will stop being reminded. Note the existing dialog only lists items required *for the stage being entered* — surfacing the left-behind set is the behaviour this rule assumes.
2. **Dated items:** `dueDate` is set and `today >= dueDate - reminderLeadDays` (from `UserProfile.preferences.reminderLeadDays`).
3. **Undated status-gate items:** `dueDate` is null, `requiredForStatus` is set, and this is the last PENDING or FAILED item for that status (all others with the same `requiredForStatus` are COMPLETE). Surfaces as "This booking could move to [status] if this task was done."

The single-booking view (Booking detail page, the "Default filter" above) deliberately keeps its **own** copy of the filter rather than sharing this one: it layers UI-density choices (current + next stage, "Show all") and has no due-date window, so only the **stage gate** is common to both. Keep the stage-gate definition identical across the two; do not "finish" the consolidation by collapsing the single-booking and cross-booking filters into one — the due-date difference would reintroduce exactly the drift this rule was written to remove.

### DigestNotification
A weekly summary email sent to the musician via Resend every Monday at 7am UTC. MVP scope. Contains two sections: upcoming Bookings this week (Mon–Sun, excluding ENQUIRY and CANCELLED), and outstanding [[BookingChecklistItem]] records across all upcoming bookings. Both sections always appear — empty states use a positive message ("Your calendar's clear this week!", "You're all caught up!"). No email is sent if both sections have nothing to show.

Checklist items are narrowed by the cross-booking **surfacing filter** defined under [[BookingChecklist]] (stage gate + dated-within-window + undated last-gate); the digest lists **all** surfaced items per booking (the Dashboard Actions widget shows only the first). Items are grouped by booking (sorted by booking date, soonest first); each booking links to `/admin/bookings/:id`. Item display: label + day of week if due this week (e.g. "Thursday"), "overdue" if past due, label only if undated. Subject line: "Your week ahead: N bookings" if gigs exist this week, otherwise "Your week ahead". HTML email, hardcoded layout (not a musician-editable Template). Implemented via `@nestjs/schedule` cron job in the API.

### MusicFormConfig
The per-booking storage for a [[MusicForm]]'s configuration. **To the musician the music form is simply on or off for a booking** — they are never asked to "create a config"; the entity is invisible plumbing. Backend principle: a `MusicFormConfig` row present == on, absent == off. Turned on via a toggle in the new-booking form (shown *after* package selection, default on when `songRequestFormEnabled`) or from the Music Form section on the booking detail page. Independent of the send-invite action — the form may be on before the invite is sent.

**The music form owns its key moments and genres — not the [[Package]].** Packages only *suggest* them: at booking creation (and when a package is applied later) the selected packages' key moments and `defaultGenreSelection` pre-fill the form, but the musician is never *constrained* to them — moments can be added, removed, or edited freely, and the form can be turned on with no packages applied at all. (The package↔set relationship — packages as client-facing set containers and a P2 fee unit — is a separate, still-open question; this entry settles only the music-form/key-moments ownership.)

**Fields:**
- `keyMoments` — `{ label: string, section?: string }[]` (**user-facing label: "Special requests"** — the term "key moment" is retired from the **booking and portal music surfaces** — the atom, the client [[Portal]], the admin portal preview, and the apply-template suggestion banners — as users did not grasp it without explanation; the [[Package Template]] editor still labels the seed list "Key moments" (renaming it there is tracked separately); the stored field and code identifiers keep the `keyMoments` name); `section` groups them in the portal form using the **same grouping vocabulary as [[Set]]s — the booking's [[Package]]s**. A moment's `section` identifies the booking-owned [[Package]] it sits under (pre-filled from the source Package on apply), or is empty → grouped under **"Other"**. The musician can **add key moments independently** via an explicit "+ Add key moment" control in the music form editor and assign each to any of the booking's Packages or to "Other" — there is **no free-text section**, grouping stays consistent with the sets. Graceful degradation (the music form owns its moments): removing a [[Package]] drops its key moments to "Other" rather than deleting them, and a music form turned on with no Packages has all moments under "Other". All moments are editable per-booking (add / remove / relabel / regroup) without affecting any [[Package Template]].
- `enabledGenres` — `string[]`; the genres shown in the general song selection. Copied from applied formats (union of all format defaults) when a package is applied, or seeded from a system default set when the form is turned on without a package; always editable. (Making the no-package default musician-configurable and library-aware is deferred — issue #530.)

The `Send music form invite` [[BookingChecklist]] item is irrelevant until the music form is turned on for the booking.

### MusicForm
The client-facing song preference form on the [[Portal]]. Has three sections:
1. **General list** — client selects from the musician's [[Song]] library; browsed via genre tabs (one tab per enabled genre in [[MusicFormConfig]]) with a search bar that queries across all enabled genres; no client details section — identity and booking date are already known from the portal token
2. **Special requests** (the section formerly labelled "Key moments" — see [[MusicFormConfig]]) — one autocomplete field per request (a named moment), grouped by section (format label) as defined in [[MusicFormConfig]]; searches the full [[Song]] library (not limited to enabled genres); free-text entry allowed if song is not in the library
3. **Notes** — freeform; covers informal requests and "don't plays"

See also [[Song]], [[MusicFormConfig]], [[MusicFormResponse]].

### Portal
The client-facing public interface at `/booking/:token`. Bypasses Clerk auth — access is validated by the Booking's `portalToken`. Sections are conditionally visible based on booking state — not every booking has every section:

- **Booking summary** — always visible; shows date, venue, sets schedule, and fee. Opens with a greeting using the customer name (e.g. "Hello, Jane!"). Internal notes and event type are never shown to the client.
- **Contract signing** — visible until signed; client reads the contract, draws or types a signature (draw is default, type is the fallback), submits; API generates the signed PDF, stores in R2, sets `Booking.contractSignedAt`
- **Signed contract download** — visible once `contractSignedAt` is set
- **Music form link** — only visible when a [[MusicFormConfig]] exists on the booking; links to the music form sub-page
- **Documents** — lists downloadable client-facing PDFs (signed contract, song list, invoices). Visibility is driven by source truth, extending the ADR-0021 / ADR-0031 pattern to invoice documents: an `INVOICE` [[Document]] appears here **only once its invoice is `Sent` or `Paid`**. An `Issued`-but-unsent or `Void` invoice is never shown to the client even though its PDF exists (the document is retained for the musician's audit trail per ADR-0042, not for client display). Contract documents are limited to the active contract.

**Routing:** the portal has three routes sharing the same musician branding:
- `/booking/:token` — main page (summary, signed contract download, music form link)
- `/booking/:token/contract` — read contract + sign; redirects to main page on success (with `?signed=1` param — main page shows a one-time success banner "Your contract has been signed — thank you!"); redirects immediately to main page if already signed. Signature canvas and submit are gated behind an "I have read and agree to the above" checkbox.
- `/booking/:token/music` — song selection form; redirects to main page on success

**API calls:** three endpoint groups, each scoped to a route:
- `GET /booking/:token` — returns: booking summary fields (date, fee, title, customerName, venueName, sets), publicProfile (full), contractSignedAt (timestamp or null), signedContractUrl (R2 public URL or null), hasMusicForm (boolean), documents (array of `{ id, type, label, url, createdAt }`, filtered to client-visible documents — invoice docs only when `Sent`/`Paid`; see [[Document]] visibility)
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

**Cancelled bookings:** the portal still loads for cancelled bookings (the token remains valid). A notice is shown ("This booking has been cancelled"). The booking summary remains visible, but the **entire contract concern is hidden** — both signing and the signed-contract download (cancellation is the outermost gate on the contract). Invoice [[Document]]s keep their own gate, so a legitimately-owed cancellation-fee [[Invoice]] can still be visible and payable. See [[Portal visibility indicator]] / ADR-0054.

### Portal visibility indicator
The admin-side answer to the musician's recurring question *"what can my client see on the [[Portal]] right now?"*. Every **conditionally-visible** portal-touching concern on the booking detail page carries a consistent indicator: a prominent **"Visible on Client Portal"** badge when the client can currently see it, or a subordinate muted **"Not visible …"** hint naming the gate holding it back (*until sent*, *— voided*, *to client*, *— cancelled*; and, once #533 lands a draft/Published model, *until published*). The hint mirrors the badge's word *visible*, so it reads as the same axis without repeating "Client Portal".

It is a **passive mirror, never a control**: it reports visibility, it does not change it (the concern's own actions — send, issue — do that). Crucially, its verdict is the *same source truth* that drives what the [[Portal]] actually renders (ADR-0021 / ADR-0031): visibility is computed by a single authority consumed by both the portal and this indicator, so the two can never disagree — surfacing the scattered rules rather than re-implementing them. See ADR-0054.

Concerns are flagged where visibility is **non-obvious**: the always-visible [[Portal]] booking summary carries no indicator (nothing to predict), but a gated concern (contract, invoices) — or a silently-private UPLOAD [[Document]] sitting among client-visible rows — *is* flagged, because the musician cannot tell at a glance. Granularity follows the concern: singleton concerns (contract, music form) show one indicator; list concerns (invoice / [[Document]] rows) show one **per row**, since each [[Document]] is gated independently. Today the music-form indicator only ever reads "Visible" (the form goes live the instant it is turned on — #533); that thinness is itself a standing reminder that the draft/Published gap is unaddressed.

### Document
A PDF stored in Cloudflare R2, associated with a Booking. Four types (stored as `DocumentType` Prisma enum): **INVOICE**, **CONTRACT**, **SONG_LIST**, **UPLOAD**.

The first three types are *system-generated* — GigMan creates the PDF automatically as part of a workflow (invoice send, contract signing, music form submission). **UPLOAD** documents are *musician-uploaded* — the musician receives a PDF from an external party (e.g. a booking agent contract) and uploads it manually. Uploaded documents carry a user-provided `name` (displayed in the Documents list); system-generated documents derive their label from their type and associated records. Uploaded documents may be deleted by the musician; system-generated documents are immutable.

**Portal visibility:** UPLOAD documents are **never shown on the client [[Portal]]** — they are private musician paperwork (an agent contract, a venue rider). Only `CONTRACT` (active, signed), `SONG_LIST`, and `Sent`/`Paid` `INVOICE` documents are client-facing (see [[Portal]] → Documents, ADR-0021 / ADR-0031). Per-document client sharing for UPLOADs is a possible future feature, not current behaviour.

**Invoice PDF:** generated at invoice **issue** time (when the invoice is created/issued, not at send — see ADR-0042), stored in R2 as an `INVOICE` Document, then attached unchanged to the outbound email at send time. Uses a fixed `@react-pdf/renderer` layout with Tiptap-JSON-driven content sections (variable substitution + line items table). Balance invoices include a deposit deduction section (subtotal, less deposit, balance due) when a deposit [[Invoice]] exists on the booking. On the client [[Portal]] the document is surfaced only once the invoice is `Sent`/`Paid` (see Portal → Documents).

**Signed contract PDF:** generated only after the client signs via the [[Portal]] — a drawn or typed signature is captured on a canvas, embedded into a PDF, and stored in R2. No unsigned contract PDF is ever generated or stored. The [[Portal]] renders `Booking.contractContent` (Tiptap JSON, variables pre-substituted at creation time) as HTML for the client to read before signing — the contract template is not re-rendered at portal time. See ADR-0001 and ADR-0013.

The signed contract PDF is generated using pdfmake (same library as invoices) via a `renderTiptapToPdfmake` converter that maps Tiptap JSON nodes (paragraphs, bold, italic, headings) directly to pdfmake content — no HTML→PDF step needed. Variable substitution is applied before conversion. The PDF structure is: musician header (name/logo), contract body, signature section (customer name, timestamp, signature image).

**Song list PDF (`SONG_LIST`):** generated at [[MusicFormResponse]] submission time. Structure: booking header (musician name, customer, date, venue), key moments section (moment label + chosen song, grouped by format section), general song requests (selected songs grouped by genre), notes (if present), submitted timestamp. Stored in R2 as a Document; available for download from the booking detail page (admin) and the [[Portal]] documents section (client).

### Dashboard
The home screen. Action-oriented — designed for the musician's morning check-in. No analytics (deferred). Three widgets stacked vertically:

1. **Actions** — one outstanding item per upcoming booking, narrowed by the cross-booking **surfacing filter** (see [[BookingChecklist]]). Only USER-completedBy items surface; CUSTOMER-completedBy passive waits (contract signed, song requests received) are omitted. Note `deposit_received` is **USER**-completedBy — the musician marks it when payment arrives — so it *does* surface (as a "mark deposit received" action). Tapping navigates to the booking detail page where the inline checklist action lives. Items in `failed` state are shown in a warning colour.

2. **Upcoming gigs** — bookings in the next 90 days (excluding CANCELLED), capped at 8 items. Each row: date, title or customer name, venue name, status pill. Tap → booking detail.

3. **Calendar** — month view. Booked dates show dots (one per booking). Tapping a date with one booking → booking detail. Tapping a date with multiple bookings → inline list of that day's bookings. Tapping an empty date → new booking pre-filled with that date. Today highlighted. Prev/next month navigation.

**Actionable checklist items shown in Actions widget:** narrowed by the cross-booking **surfacing filter** defined under [[BookingChecklist]] (stage gate + dated-within-window + undated last-gate). The widget shows **one** item per booking (the first surfaced item). Items sorted by `dueDate` ascending; undated status-gate items follow.

### Package
A **booking-owned** grouping of [[Set]]s — a non-binding, client-facing "set container" *within* the [[Booking]]'s itinerary (see design principle *the Itinerary is one concern*; ADR-0050). Created by applying a [[Package Template]] (which copies the template's slots into this Package as editable Sets) or **ad-hoc** (created directly, with sets added by hand). A Package is a **snapshot**: it carries its own `label`, `icon`, and `order`, copied at creation and **decoupled** from any template thereafter — editing a [[Package Template]] never alters an existing booking's Packages. **Provenance is severed** — a Package keeps no reference to the template it was built from. See ADR-0046.

A booking has zero-to-many Packages (ordered); each [[Set]] belongs to **at most one** Package (sets may be ungrouped — see [[Set]]). Packages are added at booking creation and edited (add / remove / reorder, plus per-Package label/icon edits) on the booking detail page. The Package is **not** a commercial/billing unit — the booking fee is authoritative and invoice line items are free-form.

### Package Template
A named **library** builder defining what a musician offers for a specific type of performance occasion — the reusable starting point for assembling a booking. Per-user — seeded from system defaults on first access (on-demand); user-defined templates are fully supported.

**A Package Template is a *distinct entity* from the booking-owned [[Package]] it produces — never conflate the two.** The Package Template lives in the musician's library and is **never linked to a booking**; a [[Package]] is a booking-owned grouping of [[Set]]s. The only relationship between them is **generative**: applying a Package Template **seeds** a booking-owned [[Package]] (and its Sets) onto the booking, after which template and Package have no link (provenance severed; see ADR-0046). Editing one never touches the other.

**Used only at apply time**: applying a Package Template to a booking seeds a booking-owned [[Package]] + its Sets, and *suggests* key moments and genres to the music form (which owns them — see [[MusicFormConfig]]). See ADR-0046.

**Fields:**
- `label` — human-readable name (e.g. "Wedding Ceremony", "Evening Reception", "Solo Piano")
- `category` (optional string) — contextual classifier; same value set as `Booking.eventType` (`WEDDING | CORPORATE | PRIVATE | RESIDENCY | FESTIVAL | OUTDOOR | FUNCTION | OTHER`). Used in two places: (1) in the booking creation form — matching-category packages appear above the fold, others below; (2) on `/admin/packages` — packages are grouped by category. Null = uncategorised; these appear in their own group.
- `keyMoments` — `string[]`; moment labels copied into [[MusicFormConfig]] when the package is applied to a booking (e.g. `["Processional", "Signing of the Register (Song 1)", "Signing of the Register (Song 2)", "Signing of the Register (Song 3)", "Recessional"]`)
- `defaultGenreSelection` — `string[]`; genre values enabled by default in [[MusicFormConfig]]; all packages default to Contemporary, Classical, Jazz, Film/TV/Musicals (Bollywood and Christmas excluded)
- `icon` — Lucide icon name (string) for display in the booking creation form and booking detail
- `sets` — ordered list of default [[Set]] definitions (label, duration, order); copied onto the booking as editable Set records when the package is applied; start times are not set on the package — added at the booking level
- `notes` (optional) — freeform description of the package
- `isSystemDefault` — boolean; true for seeded system packages, false for user-created packages. Both can be deleted — but only if no Bookings reference them (409 if referenced). Both can be edited per-user without affecting other users.
- `enabled` — boolean; disabled packages are hidden from the booking creation form picker. Mirrors the enable/disable toggle on checklist defaults.

**Template + overrides:** applying a Package Template to a booking creates a booking-owned [[Package]] — **snapshotting the template's `label` and `icon`** onto it (no backward cross-reference to the template at render time) — and copies the template's sets into it, and *suggests* its `keyMoments` + `defaultGenreSelection` to the booking's music form (which **owns** them — see [[MusicFormConfig]]). Pre-fill on apply is a suggestion, never a constraint; per-booking edits never affect the template.

**Relationship to the booking:** a Package Template is **not** linked to a booking. Its only relationship to a booking is generative — applying it produces a booking-owned [[Package]] + [[Set]]s, after which the template is out of the picture (provenance severed; see ADR-0046). Selected at booking creation via multi-select chips in the creation form; further Packages can be added/edited on the booking detail page.

**P2 (directional):** a `guideFee` on the Package Template is envisaged as an input to the Quote Calculator (see `docs/north-star.md`) — a starting-point estimate that helps the musician arrive at an overall booking quote, **not** a per-Package billed line item. Not decided here.

**Management UI (`/admin/packages`):** packages are displayed as read-only cards grouped by category. Each card shows the icon + label, and a read-only slot list (label + duration only — start times are booking-level). Card interactions: an enable/disable toggle (mirrors checklist defaults) and an Edit button that opens a right-side drawer. All editing — label, icon, category, notes, keyMoments, defaultGenreSelection, slots (add/remove/reorder with up/down arrows) — is done in the drawer with an explicit Save button. Deletion is also in the drawer (bottom, same pattern as booking cancellation). A "+ New package" button on the page opens the same drawer with empty fields.

**System defaults (seeded per user):**

| Label | Category | Sets | Key moments |
|---|---|---|---|
| Wedding Ceremony | WEDDING | Ceremony, 30 min | Processional, Signing ×3, Recessional |
| Drinks Reception | WEDDING | Drinks Reception, 90 min | — |
| Wedding Breakfast | WEDDING | Wedding Breakfast, 90 min | — |
| Evening Reception | WEDDING | Evening Reception, 45 min × 2 | First Dance |
| Corporate Dinner | CORPORATE | Drinks, 60 min · Dinner, 90 min | — |
| Background Music | — | Background Music, 60 min | — |
| Solo Piano | — | Solo Piano, 60 min | — |

### Contact Roles (on a Booking)
A Booking has up to three Contact relations, each a separate FK:
- **Customer** (required): the direct payer (e.g. a couple getting married). Rarely repeats.
- **Venue** (optional): the location of the performance. Repeats across bookings; persistent notes (e.g. parking info) live on the Contact record.
- **Booking agent** (optional): the professional third party who sourced the booking — a formal booking agent, a wedding planner acting in that capacity, or similar. Always someone with a commercial role in originating the booking; casual personal referrals are not recorded here. Repeats across bookings.

### Booking Builder
The dedicated edit surface for a [[Booking]] — a single scrolling one-pager that stacks every concern (Overview, People, Venue, Package Templates, Itinerary, Details, Music, Notes) in spine order, each rendered by its own reusable atom in self-saving (incremental-PATCH) mode. It is the **superset** edit surface, opened from the "Builder" action on the booking detail page; it replaces the retired overloaded `BookingEditDrawer`. A **completeness rail** (derived from the same predicates that drive the structural [[BookingChecklistItem]]s, so the two never diverge) gives at-a-glance progress and jump-to-section navigation. Editing a booking is incremental and a booking is legitimately incomplete for most of its life — the Builder orients rather than gates: progress is **ambient** (the rail), arrival in a section is **positional**, and an **exit-backstop** offers a final gentle nudge for still-empty sections, never a hard gate. The per-concern quick-tweak sheets reached from the detail-page cards reuse the *same* atoms; the Builder is where they are all gathered. (Layout — including the mobile presentation of the rail — is implementation detail; see ADR-0051.) Distinct from booking *creation*, which is a separate lean form ending at a commit checkpoint (ADR-0047), after which the Builder takes over. See ADR-0050.

### LaunchScreen
The public-facing entry point at `/`. Shows a hero, a sign-up CTA, and a sign-in link. Not a marketing page — no feature list, pricing, or screenshots. Authenticated users who land on `/` are redirected immediately to `/admin`.

### OnboardingFlow
A five-step wizard at `/onboarding/*` that every new musician completes before accessing the admin.

**Philosophy — guided activation, not configuration.** Onboarding collects only the data the app genuinely needs (identity) and otherwise *orients* the musician and *activates* them, rather than presenting exhaustive settings. Two recurring patterns: (1) **show, don't just toggle** — where a choice is offered, the thing being chosen is shown in enough detail to judge it (a package's sets + key moments; a task's due timing), and the act of choosing showcases that almost everything in GigMan is customisable (a headline value); (2) **configure/create one** — the musician shapes one real artifact (one package template for their most common booking type; one song) to learn the mechanic and leave with something genuinely theirs, never bulk-accepting defaults they cannot evaluate (bulk-seeding a genre of songs the musician does not actually play is anti-confidence and creates an audit chore). Deep configuration is deferred to Settings and taught in-context (see the discoverability principle). A skipped activation is not lost — it becomes a Category-1 precondition for the dashboard tips widget, which nudges the musician later, so onboarding and discoverability reinforce each other.

**Steps (ordered — "your setup, then your client experience"):**
1. **Your business** (required) — identity input: `businessName` (the act/brand — shown on the portal, invoices, emails), **"Your name"** (the personal name used to sign emails and contracts — the `displayName` field, relabelled from "Display name" to kill the act-vs-person confusion; falls back to `businessName` if blank), `email`, `phone`, optional home address (travel-time origin). Every field carries purpose-helper text and a live example of where its value appears (e.g. "appears as: *Your quote from James*").
2. **How GigMan runs your bookings** (skippable) — orientation: the default [[BookingChecklistItem]] tasks shown with friendly due timing ("Balance invoice — 2 weeks before the gig") and an explanation of the reminder feature ([[DigestNotification]] + Dashboard Actions). Items remain toggleable (informed enable/disable) to showcase customisability.
3. **What you offer** (skippable) — packages: "What's your most common type of booking?" → the musician configures **one** [[Package]] Template for that type inline (sets, durations, key moments), reusing the package editor. The full system-default template set is still seeded in the background (template + overrides). Packages are shown with their contents (collapsible: summary line → full sets + key moments). **Depends on the Package → Package Template split (ADR-0046).**
4. **Your portal & branding** (skippable) — a live [[Portal]] preview rendered *inside* the onboarding shell (reusing the preview renderer — not navigating to `/admin/portal-preview`), with inline guided branding controls (theme cards, brand-colour swatch, logo upload) that update the preview live.
5. **Emails & song requests** (skippable) — orientation on the emails GigMan sends on the musician's behalf (quote, contract, invoices, thank-you — light awareness + one peek; custom [[Template]]s are P2), plus an intro to the portal song-request form ([[MusicForm]]) and an **"add your first song"** activation (search the [[SeedCatalogue]] or add one manually; one is enough — no bulk/genre seeding). The song-request section also offers a **"not for you? turn it off"** control that sets `UserProfile.songRequestFormEnabled` to false then and there (some musicians never take song requests); disabling it hides the add-a-song activation and suppresses the related tips-widget nudge, consistent with the global toggle hiding the feature app-wide.

Each step saves immediately on "Next". Step 1 is required; steps 2–5 are skippable ("Skip for now — customise in Settings"). Completion is recorded by `POST /me/onboarding/complete`, which stamps `UserProfile.onboardingCompletedAt`. The admin route loader gates entry on this field (null → redirect to `/onboarding`); the `/onboarding/*` loader gates the other direction (field set → redirect to `/admin`). See ADR-0027.

### SeedCatalogue
A static list of songs (derived from the mick-form song list) stored as a TypeScript file in the API. Not a DB table — there is no global song pool. Exposed via `GET /songs/catalogue` as a *search source*: musicians find and add individual songs they actually play, created as per-user [[Song]] records. Used both in the Repertoire page and the [[OnboardingFlow]] "add your first song" activation. The catalogue is grouped by [[Genre]] for browsing, but there is no bulk genre-level seeding — songs are added one at a time (or via search), deliberately, to avoid an unaudited library.
