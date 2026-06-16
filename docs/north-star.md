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

## What this does *not* change

- The **hard rules** still hold without exception: Clerk-only auth, UUID primary keys, `userId`
  multi-tenancy scoping on every query, R2 for uploads, portal-token bypass for `/booking/:token`.
- **Phasing stays P-numbered.** This doc consolidates direction; it doesn't renumber anything.
- **Every feature still goes through the planning gate** (`docs/agents/issue-authoring.md`) — North
  Star alignment informs design, it doesn't replace the gate.
