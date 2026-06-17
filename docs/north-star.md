# GigMan — Wave 2 (P2) North Star

## How to use this doc

This is the agreed **direction** for the next wave of GigMan features — where we are heading after
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

## Where we are (P1)

The MVP is a complete gig-lifecycle CRM: bookings (`Enquiry → Complete`), contacts, packages & sets,
repertoire, the client portal (contract e-signing + music preference form), invoicing (including
recurring series), communications + templates, document storage, booking checklists, onboarding, and
the musician's business/brand profile.

## The North Star

GigMan's core differentiator is already stated in `CONTEXT.md`: *"a smart management system that
surfaces the right action at the right time, rather than a passive record-keeper the musician has to
manually interrogate."*

**Wave 2 extends that intelligence in four directions:** outward to the inbox (automation), upward
into understanding the business (insight), across the band (collaboration), and into natural language
(AI query). Each pillar makes GigMan more of a proactive partner and less of a passive ledger.

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
issue/paid dates and statuses; bookings carry fee, status, event type, and dates; `depositReceivedAt`
is recorded; and void/cancellation history is **preserved, not deleted**.

**Keep in mind.** Favour capturing timestamps and outcome data so metrics can be computed
*retroactively* — e.g. the existing P2 note about letting the musician enter the *actual*
deposit-received date. Don't destroy historical signal (keep voiding/soft-state over hard deletes).
A dedicated aggregation surface may be worth it, but isn't decided here.

### 3. Collaboration & band members

**What.** Band-member portals, sharing booking logistics with the players on a gig, and multi-person
gigs — expanding GigMan from a solo-musician tool toward ensemble use.

**Why it matters.** Many of the musicians GigMan serves lead bands; coordinating the players is real
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
