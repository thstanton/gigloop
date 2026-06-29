# GigLoop — Wave 2 (P2) North Star

## How to use this doc

This is the agreed **direction** for the next wave of GigLoop features — where we are heading after
the MVP, so that individual feature designs can keep it in mind and **plumb things forward in a way
that supports what's coming**.

It is **directional, not binding.** The hard rules in `SPEC.md` and the planning gate in
`docs/agents/issue-authoring.md` still govern every feature. Nothing here is committed scope, a
schema decision, or an ADR — the architectural choices each pillar implies are flagged below as
**open questions for their own future ADRs**, not decided here.

Phasing terminology is unchanged: we keep using **P1 / P2 / P3** (P1 = the shipped MVP; "Wave 2" and
"P2" are used interchangeably). This doc gives the scattered "deferred to P2" notes across `SPEC.md`,
`CONTEXT.md`, and the ADRs a single home to point at.

**When to consult it:** at the planning gate. When scoping a non-trivial feature, check whether a
small, cheap bit of "plumb-it-forward" now (a nullable field, a generic shape, a preserved timestamp)
would make a Wave 2 pillar materially easier later — without bending the current feature out of shape.

**How to extend it:** use the `shape-north-star` skill. Shaping is breadth-first direction-setting —
adding or deepening a pillar, parking architectural choices as open questions — and is the deliberate
complement to `grill-with-docs` (which converts those parked questions into binding ADRs). Keep
everything here directional; the moment a decision is ready to be made, take it to a grill session.

## Where we are (P1)

The MVP is a complete gig-lifecycle CRM: bookings (`Enquiry → Complete`), contacts, packages & sets,
repertoire, the client portal (contract e-signing + music preference form), invoicing (including
recurring series), communications + templates, document storage, booking checklists, onboarding, and
the musician's business/brand profile.

## The North Star

GigLoop's core differentiator is already stated in `CONTEXT.md`: *"a smart management system that
surfaces the right action at the right time, rather than a passive record-keeper the musician has to
manually interrogate."* P1 got the data *in* and managed individual bookings well. **Wave 2's
throughline is putting that data to work** — turning a record store into an active asset.

Each of the four pillars serves that one story from a different angle:

- **Automation & comms inbox** — get the data *in* more easily, capturing enquiries straight from
  the inbox rather than by hand.
- **Insight & analytics** — draw *deeper insight* from the data, beyond the operational view of a
  single booking.
- **Collaboration & band members** — *surface* the data to a wider set of stakeholders: the players
  on the gig.
- **AI assistant** — *find* the data faster, by asking for it in plain language.

Each makes GigLoop more of a proactive partner and less of a passive ledger.

## The four pillars

### 1. Automation & comms inbox

**What.** Inbound email ingestion that auto-captures enquiries — creating or linking
`ENQUIRY`-stage bookings from incoming mail — plus a fuller bidirectional communication log and batch
sending.

**Why it matters.** It removes manual data entry at the top of the funnel, which is where the
musician's effort is least rewarded. It also makes the `ENQUIRY` stage genuinely useful rather than a
stage most bookings skip.

**Already plumbed for it.** `Communication` is modelled generically for inbound today — `direction`
(`OUTBOUND | INBOUND`) and `status` (`PENDING | SENT | FAILED`), explicitly designed "to accommodate
inbound messages without schema changes" (ADR-0007). The `ENQUIRY` lifecycle stage and the optional
`quote` template are both documented as gaining their full value once ingestion exists.

**Keep in mind.** An inbound webhook (e.g. Resend inbound) and a way to thread/link inbound mail to a
contact by email address. Keep the async `PENDING` send path intact — it was added in anticipation of
batch sending. Enquiry classification is a natural fit for AI assistance (links to Pillar 4).

### 2. Insight & analytics

**What.** Dashboard analytics, earnings/financial reporting, pipeline health, and post-gig review.
The Dashboard today deliberately ships with *"No analytics (deferred)."*

**Why it matters.** Musicians can manage individual bookings well in P1, but can't yet *understand*
their business — earnings over time, conversion through the pipeline, which event types pay.

**Already plumbed for it.** Most of the raw data already exists and is retained: invoices carry
issue/paid dates (`issueDate`, `paidAt`) and statuses — including the distinct `ISSUED` state that
decouples *issuing* an invoice from *sending* it (ADR-0042/0043), which sharpens an "invoiced total"
definition; bookings carry fee, status, event type, and dates; `depositReceivedAt` is recorded; and
void/cancellation history is **preserved, not deleted**.

**Keep in mind.** Favour capturing timestamps and outcome data so metrics can be computed
*retroactively* — e.g. the existing P2 note about letting the musician enter the *actual*
deposit-received date. Don't destroy historical signal (keep voiding/soft-state over hard deletes).
A dedicated aggregation surface may be worth it, but isn't decided here. **The one genuine gap:**
`Booking` stores only its *current* `status` plus created/updated — there is **no status-transition
history**, so conversion-funnel / time-in-stage / pipeline-over-time analytics are impossible to
compute retroactively. They are not a Wave 2 deliverable (the user's priorities are earnings, export,
and busyness — not "am I winning the work"), but if a later wave wants them, append-only transition
capture is cheap to start now and impossible to reconstruct later — a plumb-it-forward open question.
Two further open questions for the feature's own ADR: a **charting dependency** (no charting lib in
the repo today — `recharts` vs hand-rolled SVG/CSS bars, weighed against the borders-only/no-shadow,
375px-first design system); and the **shared aggregate backend** — scoped Prisma aggregates here are
the *same* backend Pillar 4's AI assistant calls for aggregate questions (links to Pillar 4).

**Explored direction (sketch, 2026-06-24 — directional, not a committed design).** A first pass at
*how* this could work, grounded in what a working musician actually said they want to know. None of
it is decided; the real choices are parked as questions for the feature's own future ADR. A prior
grill (2026-06-14) settled much of the money model, recorded below as directional ground; this sketch
refines it against the live user input.

- **What the musician actually asks.** In their words: *bookings confirmed in a period* (this month /
  this year), *payments received in a period*, *projected earnings* for the rest of the year, a yearly
  *target*, *how does this compare to last year*, and — most emphasised — *a clean export to hand the
  accountant*. The grill's priority ordering holds: earnings and the accountant export lead, busyness
  follows, conversion-funnel questions did not come up and stay out. **Expenses / net-profit are
  explicitly out of Wave 2** (the user ruled them out) — Wave 2 analytics is turnover-side only.

- **Money, three lenses.** The user named three money views that don't
  collapse into one: (1) **booked / projected fees** — Σ `Booking.fee` over CONFIRMED-and-beyond,
  including future-dated gigs ("rest of the year"); (2) **payments actually received** in a window —
  real cash, anchored by payment date (`paidAt` / `depositReceivedAt`); (3) **invoiced total** — the
  figure for the accountant (Σ amounts of issued invoices: status ∈ {`ISSUED`, `SENT`, `PAID`},
  excluding `DRAFT` and `VOID`). The parked grill deliberately leaned *away* from payment-marking
  ("users treat Paid as a reminder driver, not proof money landed") and made the export invoice-based;
  the live user **resolves that tension the other way**: the cash-received view *is* wanted, so
  marking-as-paid should be embraced as a reporting driver — which carries three obligations (next
  bullet) to make it trustworthy.

- **Making the cash-received lens trustworthy.** If paid-marking drives reporting, three things the
  data model doesn't carry today must follow — directional, with the schema/UX specifics parked for
  the feature's ADR: (1) **set the expectation** — the UI must make clear that marking an invoice paid
  *drives the financial reporting*, not just dismisses a reminder; (2) **a separately-enterable actual
  payment date** — today the only signal is the moment the user taps "paid"; the real payment date can
  differ, so the musician needs to record the *actual* date distinct from the mark-paid timestamp. This
  reuses the two-path pattern already proven by `depositReceivedAt` (automatic signal + manual
  override); (3) **an optional payment reference** — stored when known, useful on the accountant
  export. None of these three fields/behaviours exists yet; they are the gap this lens opens.

- **Projection and a target.** Beyond money-to-date, the user wants a *forward* number: confirmed-and-
  beyond fees for the rest of the year, plus an aspirational **target** that folds in the speculative
  tier (provisional + enquiry). This refines the grill's three tiers (Earned / Confirmed / Potential):
  the conservative headline stays conservative, but there is appetite for a separate target figure that
  *does* include speculative work. How the target is composed and shown distinctly from the booked
  headline is parked.

- **Period model: tax year as the primary lens, flexible queries as the multiplier.** The **UK tax
  year is the single most useful lens** (6 Apr–5 Apr) and the natural anchor for the accountant export —
  but the user is clear that **customisation is the key that unlocks the rest**: flexible period queries
  (month, this-year, rest-of-the-year, vs-last-year, arbitrary ranges) open up many use cases beyond the
  tax-year default. So the direction is a tax-year-default surface layered over a **flexible period-query
  capability**, not a single fixed window. Year-over-year comparison — a nice-to-have at the grill — is
  promoted by the user to a wanted view. The exact query model (preset set vs arbitrary ranges, how far
  back prior years reach) is parked for the feature's ADR.

- **Export, two shapes.** (1) A **bookings CSV** over a chosen period — the user asked for this
  directly. (2) The **accountant export** — tax-year-aligned, invoice-sourced, the most emphasised
  item ("particularly useful"). Formats (CSV vs a styled PDF summary reusing the existing PDF infra),
  exact columns, and delivery (stream-download vs email) are parked for the feature's own design.

- **Surface: hybrid (unchanged from the grill).** Glanceable **headlines on Home** (earnings + booking
  counts in the same status tiers); a dedicated **Analytics page** for fuller breakdowns, period
  selection, comparisons, and the exports. Build each widget as a self-contained, independently-
  mountable unit so a future customisable-dashboard layer can select them — matching the existing
  feature-component principle.

- **What v1 defers.** Expenses / net-profit (explicitly ruled out). Conversion-funnel & time-in-stage
  analytics (no status-transition history — see *Keep in mind*). Per-event-type / per-venue / per-
  customer breakdowns (dropped at the grill). Customisable dashboard. The cash-received lens is now
  *directionally adopted* (embrace paid-marking), but its three supporting pieces — the paid-driven
  reporting expectation, the separately-enterable actual payment date, and the optional payment
  reference — plus the target's composition and the flexible period-query model are handed to the
  feature's own grill/ADR.

### 3. Collaboration & band members

**What.** Band-member portals, sharing booking logistics with the players on a gig, and multi-person
gigs — expanding GigLoop from a solo-musician tool toward ensemble use.

**Why it matters.** Many of the musicians GigLoop serves lead bands; coordinating the players is real
work the app doesn't yet touch.

**Already plumbed for it.** Several hooks already anticipate this: `BookingChecklistItem.completedBy`
includes a `BAND_MEMBER` actor; the booking `logistics` JSON carries a per-entry `shareWithBand` flag
(ADR-0034); `clientPortalConfig` was deliberately named to leave room for a *sibling* band-member
portal config (ADR-0015); and the existing portal-token pattern is a reusable model for an
unauthenticated band portal.

**Keep in mind — this is the biggest architectural stretch.** It introduces a **new actor** against
the single-`userId` multi-tenancy hard rule. Whatever shape band members take (contacts with a role,
a new entity, or invited users), it **must not break `userId` scoping**, and it will need its own
ADR(s) when it lands. It also revisits the currently-deferred "cross-booking awareness / band member
coordination" design principle called out in `CONTEXT.md`.

**Explored direction (sketch, 2026-06-17 — directional, not a committed design).** A first pass at
*how* this could work. None of it is decided; it exists so future feature designs share a mental
model.

- **Band member identity: Contact + join table.** Band members are Contacts (the existing model). A
  new `BookingBandMember` join table links them to specific bookings: `bookingId`, `contactId`,
  `userId` (inheriting the organiser's `userId` — so the multi-tenancy hard rule holds), plus an
  `instrument`/`role` label, a `bandPortalToken` (unique UUID), and `sessionFee` (the agreed gig fee
  for this booking). No "named band" concept in P2 — band membership is per-booking, and the roster
  is fluid: deps vary gig-to-gig, with some regulars. The Contact gains a `defaultSessionFee` field:
  the dep's usual rate, private to the organiser, never surfaced to the band member, and used as a
  default when the booking-specific fee is set and as an input to the Quote Calculator (see below).
  This follows the same pattern as `Contact.commissionArrangement` for booking agents — a role-
  specific field on an otherwise role-agnostic model.

- **Confirmation model: two paths, organiser has final say.** A dep can confirm via their portal
  (self-service), or the organiser can confirm on their behalf with an optional note (e.g. "Confirmed
  on WhatsApp"). Both paths update `BookingBandMember.status` (`INVITED → CONFIRMED`). The model
  deliberately does not depend on portal adoption — the organiser always has an override. They can
  also mark a member `DECLINED` or replace them at any time. This mirrors the two-path pattern
  already used for `depositReceivedAt` (automatic via invoice, or manual override).

- **Portal pattern: x members = x tokens, x states.** Unlike the client portal (one token per
  booking), each `BookingBandMember` row has its own `bandPortalToken`. The band member portal lives
  at `/band/:token` — a sibling of `/booking/:token`, bypassing Clerk auth via `@Public()` in the
  same way. The portal is **branded** (uses `PublicProfile` data; `bandPortalConfig` namespace on
  `PublicProfile` was reserved in ADR-0015 for any band-specific overrides). What the portal shows:
  booking date/time/venue, logistics entries where `shareWithBand: true` (already stored per entry —
  ADR-0034), the PerformanceSets running order, and the member's own instrument/role. A single "I
  confirm I'm available" action updates their status in GigLoop. The portal is **read-only beyond
  confirmation** in v1.

- **Checklist integration: the BAND_MEMBER actor activates.** `BookingChecklistItem.completedBy:
  'BAND_MEMBER'` is already dormant in the codebase (ADR-0016). When the portal ships, items
  assigned to `BAND_MEMBER` appear on the dep's portal and can be ticked off there. On the
  organiser's side, the checklist shows which items are pending band member action. The confirmation
  itself is the natural seed for the first `BAND_MEMBER` checklist item: "Confirm availability."
  This is ADR-0031's envisioned multi-stakeholder checklist model becoming concrete.

- **Musician's view.** A "Band" section on the booking detail page (parallel to "On the day" /
  logistics). Lists all band members: name, instrument/role, status (Invited / Confirmed /
  Declined), and controls to add, resend invite, confirm on behalf, or remove. The organiser sees
  each member's `sessionFee` inline; the dep does not (yet — see below).

- **Fee model: two tiers.** `Contact.defaultSessionFee` is the dep's usual rate — private to the
  organiser, never surfaced to the dep, and the starting-point input when setting a booking-specific
  fee. `BookingBandMember.sessionFee` is the agreed fee for this gig — the value that flows into any
  agreement or document the dep receives. Whether the gig fee appears as a visible value on the band
  member portal or within a downloadable agreement document is **deferred**; the data model carries
  it either way.

- **Quote Calculator (cross-pillar P2 feature).** A related P2 feature sitting at the junction of
  this pillar and Pillar 2. Inputs: **Package Template guide fees**, per-member `Contact.defaultSessionFee`
  values, mileage, and manual adjustments. Output: a calculated base quote the organiser reviews
  and customises before sending to the client. The fee fields described above are the band-member
  inputs to this calculator; they should be present in the schema from day one so the calculator can
  be built without retrofitting.
- **Package Template guide fee (directional, 2026-06-17).** Following the Package / Package Template
  split (a `Package Template` is the reusable library builder; an applied `Package` is a booking-owned
  grouping of sets — see CONTEXT and its ADR), a **guide fee on the `Package Template`** is envisaged
  as an input that *helps the musician arrive at an overall booking quote* — **not** a per-`Package`
  line item billed separately. Quoting stays at the booking level; the template fee is a starting-point
  estimate, the same way `Contact.defaultSessionFee` guides the band-member fee. The exact mechanism
  (how multiple template fees combine, how mileage and adjustments fold in) is for the Quote
  Calculator's own future design — flagged here, not decided.

- **Calendar: .ics attachment as the universal bridge.** The band member invite email (via Resend;
  a `band_invite` built-in template) includes a `.ics` calendar attachment: event date/time, venue
  address, and a link to their portal. This lands in the dep's existing calendar workflow with zero
  friction — no account, no app. A separate iCal feed for the *organiser* (so their own GigLoop
  bookings appear in Google Calendar / Apple Calendar / Outlook) is a related but distinct feature.

- **Customer insight: musicians operate in WhatsApp.** Deps are resistant to adopting new tools and
  often dep for several bands, each potentially using different platforms. WhatsApp is a primary
  communication channel for many musicians. The portal and `.ics` invite are designed to deliver
  value *through* existing workflows rather than replace them. The invite email should be clear and
  easy to forward. A WhatsApp Business API integration — outbound template messages delivering the
  portal link — is a plausible future channel but is deferred until the portal is proven. Full
  two-way WhatsApp confirmation is high complexity and not in near-term scope.

- **Network effect principle: the booking as a multi-stakeholder event.** Every band member is a
  potential future GigLoop user — many deps lead their own bands; the band member portal is a product
  demo and should be polished accordingly. Looking further ahead: if a dep signs up to GigLoop, their
  email address is the natural link to Contact records where they are already listed as a band member
  on other users' bookings. The shared layer defined here — logistics with `shareWithBand: true`, the
  running order, `BookingBandMember.sessionFee` — is the foundation for future **authenticated
  cross-user visibility**: a dep's GigLoop account surfacing gigs they're part of alongside gigs they
  organise. The full implications (GDPR, consent model, cross-tenant read access architecture) are
  not designed here and will need their own ADR(s). **The design principle for now:** model band
  member data with a clear shared / organiser-only distinction from the start, so this future can be
  built without retrofitting.

- **What v1 defers.** Authenticated cross-user visibility. Fee visibility mechanism on the portal
  (visible value vs. downloadable agreement). WhatsApp integration. Song-level set lists (flagged as
  a P3 feature — v1 shares the PerformanceSets running order only).

### 4. AI assistant (natural-language query)

**What.** Free-text questions over the musician's own data — *"which weddings haven't paid their
balance?"* — translated by an LLM into a structured query. An extension of the existing search, not a
separate data store.

**Why it matters.** It turns the whole CRM into something the musician can interrogate
conversationally, and pairs naturally with the insight pillar (NL questions over their analytics).

**Already plumbed for it.** Server-side booking search with an active-pipeline default (ADR-0041) is
the structured foundation to build on. The clean DTO contract — `@ApiProperty` on every field, the
shared `apps/web/src/types/api.ts` types, and the consistent API response shape — gives an LLM a
well-described surface to target.

**Keep in mind.** (a) **New stack dependency** — there is no LLM provider in the stack today; that's an
explicit decision for its own ADR (default to the latest Claude models). (b) **Security is the load-
bearing concern** — any generated query must be constrained to the authenticated `userId` and routed
through the existing validated filter/search layer, **never** raw cross-tenant SQL. (c) Keep DTOs
well-described as the model's contract. (d) Overlaps with Pillar 2.

**Explored direction (sketch, 2026-06-16 — directional, not a committed design).** A first pass at
*how* this could work. None of it is decided; it exists so future feature designs share a mental
model. The real design choices below are flagged as questions for the feature's own future ADR.

- **Query translation: tool / function calling.** The LLM is given a small set of tools that map onto
  the existing validated repository methods (`searchBookings` maps 1:1 to the ADR-0041 search;
  `searchSongs`, `searchContacts`, etc. follow). The app executes them server-side with `userId`
  injected from the Clerk JWT — the model never sees or sets `userId`, and tools return real rows, so
  there is nothing to hallucinate. Aggregate questions ("earnings in May", "busiest month") become
  their own tools backed by scoped Prisma aggregates — the **same backend the Insight pillar uses**.
  Alternatives considered and set aside: a generic filter-DSL / blend (more bespoke grammar to own),
  text-to-SQL (largest security surface, cuts against the `userId` hard rule), and RAG/semantic
  retrieval (a possible *later* complement for fuzzy/notes questions, not the foundation).
- **Scope: read-only Q&A.** Find / filter / summarise; no mutations in the first version, so no
  confirmation-flow design is needed yet. Write-actions, if ever added, would need confirmation gates.
- **Response shape: narrative + records, both returned.** A two-pass loop — user query → LLM
  interprets and calls tools → backend fetches real records → results returned to the LLM → LLM writes
  a direct narrative answer grounded in that data → API returns `{ answer, records }`. The UI renders
  the narrative alongside the canonical record card(s); the card stays the source of truth, so a
  manipulated or imperfect narrative is backstopped by the visible data.
- **UX: a global command palette** (⌘K on desktop; a top-bar icon on mobile — *not* a bottom-tab-bar
  slot; the bookings-list search stays as it is). It is **tri-modal**: (1) standard cross-entity quick
  search (existing endpoints, instant, no LLM), (2) quick actions (e.g. "Create booking" — a small
  command registry, mostly navigations), and (3) **Ask** — free-text that invokes the LLM assistant.
  The **LLM is invoked only on the explicit "Ask" action, never per keystroke**, so search and actions
  are the cheap default and the LLM is a deliberate escalation. Answers are **one-shot** (ask → answer
  → ask again, not a chat thread); result cards are tappable and navigate to the record. This is a new
  cmdk-style shared component (buildable on the existing `Dialog`/`Sheet` + `Input`, or adopt `cmdk`)
  — to flag for approval at planning time.
- **Where it runs / model:** API-side (like PDF generation), via a new `@anthropic-ai/sdk` dependency,
  on a **small/fast model tier** (tool selection + grounded summarising suits it) — Haiku-vs-Sonnet
  left to evaluation, not pinned here. Resolve relative dates ("this week") to ISO ranges in code
  rather than asking the model to do date arithmetic.
- **Guardrails — injection is largely contained by the architecture.** Because the assistant is
  read-only, tenant-locked (`userId` server-side), has no write/send tools, and holds no secrets in
  context, a hijacked model can at most distort the *narrative* — it cannot exfiltrate cross-tenant
  data or take actions, and the canonical records rendered alongside are the backstop. Treat tool
  results as **data, not instructions**. The residual injection surface is *indirect* (untrusted
  third-party content — contact names, notes, and especially the inbound emails of Pillar 1). For
  cost/abuse: a **hard per-response output cap** plus a **tightly-scoped system prompt** so off-topic
  prompts map to no tool and get a cheap canned refusal. Per-user quotas and subscription-tier gating
  (ADR-0015) are deferred backstops to revisit once the assistant has proven its value.
- **Possible later optimisation (not designed in):** pre-loading a bounded "hot set" of upcoming gigs
  so the most common questions can be answered in a single pass. The sketch keeps to the clean
  two-pass tool-loop.

## What this does *not* change

- The **hard rules** still hold without exception: Clerk-only auth, UUID primary keys, `userId`
  multi-tenancy scoping on every query, R2 for uploads, portal-token bypass for `/booking/:token`.
- **Phasing stays P-numbered.** This doc consolidates direction; it doesn't renumber anything.
- **Every feature still goes through the planning gate** (`docs/agents/issue-authoring.md`) — North
  Star alignment informs design, it doesn't replace the gate.
