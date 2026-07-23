# Package-template popularity / usage analytics — out of scope

**Issue:** #509 — "Most popular package templates (usage tracking + analytics)"
**Decided:** 2026-07-23 (triage). **Origin:** parked from the ADR-0049 (Copy Event) grill, 2026-06-19.

## The request

Track how often each Package Template is applied to a booking, and surface a
"most popular" ranking (e.g. to order templates in the booking builder).

## Why it's out of scope

**Value doesn't clear the cost at this product's scale.** GigLoop is a solo-musician
CRM. The template library **starts empty** by design (onboarding step 4 / #663) and the
musician shapes templates one at a time — a realistic user has ~1–8 templates, all
self-authored, all visible on one screen in `PackagesPage`. Ranking a handful of things
you wrote yourself by usage tells you what you already know.

The build is not cheap: a new usage table (no booking↔template record exists today —
`PackageTemplate`/`PackageTemplateSlot` have no booking relation, by design per ADR-0046),
a write into **both** booking-create paths, a cascade-vs-snapshot decision on template
deletion, a tenant-scoped aggregate query, and an **amendment to ADR-0046's deliberately
severed provenance** — all for a sort order. The cost/benefit only inverts at a scale
(dozens of templates, multi-user bands) that doesn't exist yet.

## Corroborating decisions

- **ADR-0046** severs render-provenance between bookings and templates on purpose
  ("provenance is severed"); this asks to carve a hole in a load-bearing invariant.
- **ADR-0049** already *rejected* using template-usage for series pre-fill — "an apply-log,
  not a mirror" (`docs/adr/0049-...:20`) — leaving analytics as its only surviving
  justification.
- **north-star.md** does **not** cover it: Package Templates appear only in Pillar 3's
  quote-calculator note (guide fees), and Pillar 2 (Insight & analytics) explicitly defers
  this family under *What v1 defers* — "Per-event-type / per-venue / per-customer breakdowns
  (dropped at the grill)." Template-popularity is that family. The issue's "North Star
  direction" claim is stale.

## What would reopen this

- The scale assumption changes — **band/multi-user accounts** (many templates, shared
  authorship), or a template *marketplace/library* users don't author themselves.
- A concrete user-observable need that a **cheaper MRU ordering** (last-applied-first,
  derivable without a new table) cannot satisfy — test that first.
- Pillar 2 re-adopts per-dimension breakdowns at a future analytics grill.
