# ADR-0041 — Server-Side Booking Search with an Active-Pipeline Default List

## Status
Accepted

## Context

The bookings list page filters by status only. It fetches **every** non-cancelled booking for the user in one request and holds the whole set in the browser; the table sorts that set client-side. There is no text search, no pagination, and no filtering beyond status.

We want booking search plus an event-type filter and a date-range filter. The defining requirement that shaped the architecture: **every booking must be searchable — including Complete and Cancelled bookings, across any date range.** "It would be weird for any booking to be non-searchable."

That requirement breaks the client-side approach. Client-side filtering only works while the loaded set is bounded. The moment search must reach the entire history — every dead enquiry, every cancelled gig, years deep, forever-growing — loading all of it into the browser on every visit to the list page is the one thing that genuinely degrades over time. (We have hit this exact wall on a previous client-side implementation.)

A second force: the search endpoint is intended to be the first consumer of a **reusable query primitive**. A command palette (combined search + navigation) and an AI chat layer ("Am I free on the 12th?", "What's the dress code for the Smith wedding?") are planned. Those callers must be able to query the corpus freely, without inheriting the list page's UI assumptions.

## Decision

### 1. Server-side search via one composable query primitive

A single endpoint carries every filter as an orthogonal, optional query parameter:

```
GET /bookings?q=&status=&eventType=&from=&to=
```

- `status` accepts **multiple values** (e.g. `status=CONFIRMED&status=READY`), not a single enum. This lets the browse view request the four pipeline statuses explicitly, and lets a future palette/AI caller pass any combination.
- The API has **no hidden defaults and no opinion about a "pipeline."** You ask for exactly what you want; you get exactly that. The smart resting state lives entirely in the frontend (see §3), so other consumers are never fighting a server that secretly hides Complete gigs.
- Filter parameters go into the TanStack Query key, restoring the project's normal "filter in the query key → refetch" convention (which client-side filtering would have broken).

### 2. Text match: tokenised, case-insensitive substring

- `q` is split on whitespace into tokens. **Each token must match at least one field (OR across fields); all tokens must match (AND across tokens).** So "Smith wedding" matches a booking whose customer is *Smith* and whose title is *Summer Wedding*. This is what makes search feel intelligent and is the behaviour the future palette/AI layer wants underneath it.
- Tokens shorter than 2 characters are ignored, so a stray "a" doesn't match everything.
- Match is case-insensitive substring (`contains` / ILIKE) — no fuzzy/typo tolerance in v1.
- Matched fields: customer name, customer email, title, venue name, booking-agent name, series label, event type, and notes.

**Tenant scoping is a correctness invariant, not a detail.** This is the most complex `where` clause in the repo — an AND-of-tokens, each an OR across scalar fields *and* nested relation filters (customer/venue/agent name). `userId` **must wrap the entire tree as a top-level AND**, never as a sibling inside any OR branch, or the query leaks cross-tenant rows. A test asserting that another user's matching booking is excluded is part of the search slice's definition of done.

### 3. Active-pipeline default, with scope that lifts on search — a frontend concern

The list page has two behaviours, both expressed by *what params it chooses to send*:

- **Resting state (no search, no filter):** the page requests the **active pipeline** — `status in {ENQUIRY, PROVISIONAL, CONFIRMED, READY}`, excluding Complete and Cancelled — ordered by date ascending (upcoming first). This keeps the day-to-day list useful; finished and dead gigs don't clutter it.
- **Search or filter active:** the page **drops the status constraint** and queries all statuses, so a search from the default view finds the completed "Smith wedding". The headline feature depends on this.
- **Explicit status selection always wins:** clicking a status tab — including "Active" — re-constrains to that status, search or not.

To keep the lit tab always truthful, **typing a search or applying a filter from the default clears the "Active" highlight into a neutral "all results" state.** A lit tab therefore always means "constrained to this status"; it never silently shows Complete/Cancelled under an "Active" label. The "All" tab is replaced by **"Active"** (see CONTEXT.md → *Active pipeline*); there is no literal "all bookings" tab, by design — that would reintroduce the unbounded load we are eliminating.

### 4. Controls layout — mobile-first

Per the "mobile space is a scarce resource" principle, controls are tiered by importance:

- **Search** — always visible, full-width, under the page header.
- **Status** — existing pattern unchanged: tab bar on desktop, select on mobile.
- **Event type + date range** — secondary; behind a **"Filters" Sheet** on mobile (with an active-filter count badge), inline compact dropdowns on desktop.

Event type is **single-select** in v1. Date range ships as the **last slice** of this feature (it is the fiddliest control and is independent of search). A no-results empty state ("No bookings match …" + clear-search action) is distinct from the first-run "No bookings yet" state.

### 5. Sort and pagination

Sort stays **client-side** on the returned result set (date / customer / venue / fee; default date-ascending), unchanged from today. The Complete tab defaults to date-*descending* (most recent first). **Pagination is deferred** — search inherently narrows results, and the active-pipeline default keeps the unfiltered view small. When pagination eventually lands, sort moves server-side with it.

## Consequences

- The bookings list always round-trips to the server on filter/search change. This is the deliberate trade for an unbounded, fully-searchable corpus.
- **Known scaling trade-off — documented, not yet acted on:** an `ILIKE '%term%'` leading-wildcard match cannot use a B-tree index; it is a per-user sequential scan. Fine at solo-musician scale, but it is the *same* growth concern that drove us server-side. The lever, when scale demands it, is a **`pg_trgm` GIN index** — which accelerates both ILIKE-contains *and* the future fuzzy match the command palette will want. Pull it then, not now.
- The endpoint is a primitive other features consume; changes to its contract must preserve that generality (no list-page-specific behaviour baked in).
- The frontend owns the resting-state logic. Any new consumer of the endpoint must supply its own status scope explicitly.

## Alternatives considered

- **Client-side filtering of an all-bookings load:** rejected. Works only while the set is bounded; the "everything searchable, forever" requirement makes the set unbounded and ever-growing. Known to degrade — we have hit this wall before.
- **A literal "All" tab that loads everything:** rejected — reintroduces the unbounded load the design exists to remove.
- **Baking the "active pipeline" default into the API:** rejected — it would force the future palette/AI callers to fight a server that hides Complete/Cancelled. The smart default belongs to the list-page UI, not the primitive.
- **Whole-string (non-tokenised) match:** rejected — "Smith wedding" would fail to match Smith-the-customer + Wedding-the-title, which is the common case.
- **`pg_trgm` / full-text search now:** rejected for v1 as premature; named as the explicit upgrade lever for when scale or fuzzy matching demands it.
- **Kanban board view:** considered and dropped from scope.
