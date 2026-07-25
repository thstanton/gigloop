# ADR-0067 — Global Command Palette: Quick Search + Quick Actions

## Status
Accepted

## Context

North-star Pillar 4 (`docs/north-star.md`) sketched a **tri-modal ⌘K command palette**: (1) cross-entity quick search, (2) quick actions, and (3) an LLM "Ask" mode. This ADR covers **modes 1 and 2 only**. The AI assistant (mode 3) is deferred to its own effort — the owner's explicit call that a fast, deterministic search/navigation accelerator should land *before* the LLM layer.

The design was charted and resolved as a wayfinder map — [Map #773](https://github.com/thstanton/gigloop/issues/773) — over eight investigation tickets (#774–#781, #789). This ADR records the binding decisions those tickets reached; each `#NNN` links to the ticket holding the full reasoning. An interaction [prototype (#780)](https://github.com/thstanton/gigloop/issues/780) validated the feel before anything was committed.

The palette is **additive**: existing in-page search surfaces — the bookings list `?q=` (ADR-0041), the song-catalogue search, the contacts list — stay exactly as they are. The palette is a new, additional way in that **reuses the same backend search path** rather than growing a parallel one. It is dark-launched behind an environment feature flag (default-off), per the standard flag convention.

## Decision

### 1. Searchable scope — Bookings and Contacts only (#774)

v1 searches **Bookings** and **Contacts**. Both have detail pages a result can open (`/admin/bookings/:id`, `/admin/contacts/:id`), and Bookings already carries the ADR-0041 search backend.

**Songs are out of scope** — maintaining the song library is a secondary maintenance activity, not something reached for under time pressure, and songs have no per-song detail page to land a hit on. The set is **architecturally open** (adding an entity later is configuration, not a rebuild) but there is **no committed roadmap** beyond the two.

### 2. Backend — one aggregating endpoint in a new `SearchModule` (#775)

A single **`GET /search?q=`** endpoint, in a **new `SearchModule`** that composes per-entity search methods (`searchBookings`, `searchContacts`).

- Chosen over client fan-out to per-entity endpoints so that `GET /bookings`'s **active-pipeline default is left untouched**: the SearchModule calls the *neutral* booking `where`-builder with its own status set, rather than reusing `GET /bookings?q=` (which defaults to the active pipeline and would have to change — breaking the existing list). One round trip also suits mobile.
- The service/repository **search methods stay pure and `userId`-from-context**, decoupled from the HTTP/palette DTO — response shaping lives in the SearchModule. This is deliberately tool-shaped (see §8).
- `searchBookings` reuses the existing `buildBookingSearchWhere` (ADR-0041). `searchContacts` is new — contacts have no free-text search today.

### 3. Response contract — a discriminated result array (#775)

The endpoint returns **`SearchResult[]`** — a discriminated array, each item `{ type: 'booking' | 'contact', id, url, …display }` — **not** a grouped `{ bookings, contacts }` object.

- Chosen to honour §1's architectural-openness: a discriminated array absorbs a new entity type without changing the wire shape; a grouped object needs a DTO change every time.
- **Top-N per type, no pagination** — the palette shows a handful per type; "see all" navigates to the full list page.
- Each item carries at minimum `{ type, id, url }`, the `url` being the navigation target the result opens.

### 4. Match rules (#776)

- **Bookings — inherited, not a free choice.** "Shared backend, no parallel implementation" means reusing `buildBookingSearchWhere`, so the palette inherits its rule as-is: title, customer name/email, venue name, agent name, series label, event type, notes — AND-ed across whitespace tokens (2-char minimum, case-insensitive).
- **Contacts (new):** match `name`, `email`, `phone`, `addressLine1`, `city`, `county`, `postcode`, using the **same tokenizer** as bookings. Address fields are included for "where, not who" recall (finding a venue by location when the name's forgotten) and are forward-compatible with band members (Pillar 3, likely Contacts). `notes` is **excluded** for contacts (freeform → more noise than signal).
- **Tenant scoping is a correctness invariant** (as ADR-0041): `userId` wraps the entire `where` tree as a top-level AND, never a sibling inside an OR branch. A cross-tenant-exclusion test is part of the search slice's definition of done. `userId` comes from the Clerk JWT, never the query.

### 5. Ranking and grouping — grouped by type, Bookings first (#776)

Results are **grouped by type — a Bookings section, then a Contacts section** — not interleaved by a cross-type relevance score (which, comparing a booking to a person, would be arbitrary).

The grouping is intent-led: typing a name most often means "find the gig", so bookings sit on top; the contact row is the **gateway** to the secondary intents (get their details, see all their bookings) via its detail page, which already aggregates both.

Because `ILIKE` is boolean (no text-relevance rank), **within-section order is by concrete columns**:
- **Bookings:** non-cancelled above cancelled (cancelled **sunk to the bottom**), then by event date (upcoming-first, then most-recent past).
- **Contacts:** by booking count, descending (the people you work with most surface first).

The palette spans **all six booking statuses** including COMPLETE and CANCELLED — it is a "find anything" tool. **Match-quality scoring** (ranking by which field hit, prefix vs mid-word) is deferred out of v1.

### 6. Quick actions — nine pure navigations (#777)

The quick-actions mode is **9 actions, every one a pure `navigate(to)` — the palette never mutates state.** Seven section navigations (Dashboard, Bookings, Contacts, Repertoire, Package Templates, Templates, Settings) plus two route-based creates (**New Booking** → `/admin/bookings/new`, **New Contact** → `/admin/contacts/new`). The two creates route to a *form*; the palette writes nothing, so no confirmation/loading/rollback machinery applies.

**Declared once, per the "one declaration per vocabulary" rule:** the nav destinations move out of `AppShell.tsx` into a canonical `NAV_DESTINATIONS` table in `constants.ts` (AppShell then *derives* its nav), plus a small `QUICK_ACTION_CREATES` table. Both `as const satisfies readonly Row[]`, both with a **`keywords` column** so actions are findable by synonym ("add gig" → New Booking; "songs"/"setlist" → Repertoire).

**Deferred:** in-place creates (New Package, Add Song, New Template — they need a bespoke open-on-arrival param and are secondary activities), Settings deep-links (which want a separate Settings restructure), and contextual "New booking for {contact}".

### 7. Shell, entry, and mobile behaviour (#778, #779)

- **Shell: `cmdk`** (the shadcn `Command` primitive). Its `Command.Dialog` composes the already-installed `@radix-ui/react-dialog`; it ships combobox/listbox accessibility + keyboard navigation; `Command.Group` maps onto §5's grouping; and its keyword-alias filtering maps onto §6's `keywords`. Server search is fed in with `shouldFilter={false}` (the results are already ranked server-side); the quick-actions section uses cmdk's built-in filter over the local registry. **`cmdk` is a new dependency** and the palette is a **new `components/common/` component** — both approved here.
- **Container:** a **new palette-specific `components/common/` component** using the same one-Radix-Dialog + CSS-at-`md` technique as `responsive-dialog.tsx`, but **not** that component (whose bottom-sheet is scoped to confirmations). On **mobile** the palette is a **full-height, top-anchored sheet** — input pinned at the top, results scrolling below it — because a bottom sheet would be buried under the on-screen keyboard. On **desktop** it is a **centred dialog** floated toward the top.
- **Entry:** mobile — a **magnifying-glass icon** at the right edge of `MobileTopBar` (the tab bar is full and structural; the top bar has room). Desktop — **`⌘K` / `Ctrl K`** plus a visible `Search… ⌘K` button in `DesktopTopBar` for discoverability. `⌘K` is the settled chord (browsers don't bind it).
- **Framing:** desktop-primary accelerator; **search-first on mobile** (the tab bar already carries navigation, so on mobile the icon reads as search and actions ride along as a secondary section).
- **Selection:** desktop — arrow keys move the highlight, `Enter` opens it, `Esc` closes; mobile — direct tap (≥44px targets), `Cancel` to close. Either way, selecting closes the palette and navigates to the result's `url` or the action's route.
- **Empty state:** the palette opens to **Recent** (recently-viewed bookings/contacts), not a bare prompt, with **New Booking pinned** on that initial list regardless of recency. The *source* of "recent" (client-side recency vs a light server signal) is a build detail for the PRD.

### 8. Plumb-forward for the Ask mode — seams, not scaffolding (#781)

No v1 decision blocks the future LLM "Ask" mode. Two seams are **shaped actively** (both are good design regardless): the search methods stay decoupled from the palette DTO with `userId` injected server-side (§2) — the shape a model-callable tool needs — and the result row is built as a **reusable, type-keyed card component** so an Ask answer's `{ answer, records }` can render narrative alongside the *same* cards. A third seam is kept **open but not built**: the palette can host an answer block, not only navigable rows. **No Ask-specific UI or scaffolding ships in v1** (no mode toggle, no "coming soon" stub). The LLM provider/SDK, tool schemas, system prompt, and injection/cost guardrails belong wholly to the assistant's own future effort.

### 9. Indexing — naive `ILIKE`, deferred index (#789)

v1 uses naive `ILIKE` (`contains` + `mode: insensitive`) with **no search-related schema change** — the palette ships with no migration and stays off the one-schema-PR lock. The `@@index([userId])` on both tables narrows every search to a single tenant's few-hundred rows before the leading-wildcard scan, which is trivially fast at solo-musician scale. This is the same trade-off ADR-0041 already documented.

**Revisit trigger:** add a `pg_trgm` GIN index (the additive, one-step fix) when either a single tenant's bookings or contacts cross roughly a few thousand rows, or Neon slow-query logs show search latency becoming noticeable.

## Consequences

- The palette is a second consumer of the booking search primitive (ADR-0041 anticipated exactly this), and the first consumer of a new contact search primitive. The `SearchModule` owns cross-entity concerns; feature modules keep owning their own search methods.
- `NAV_DESTINATIONS` moving into `constants.ts` is a small refactor that benefits `AppShell` independently of the palette.
- A new dependency (`cmdk`) and a new shared component (the palette container) enter the codebase — both deliberate, approved here.
- v1 adds **no migration**. The deferred `pg_trgm` index is the named lever for when scale demands it (shared with ADR-0041's booking-search concern and the future Ask fuzzy-match).
- The Ask mode remains a clean future drop-in: the search layer is tool-shaped and the result card is reusable, without any speculative code shipping now.

## Alternatives considered

- **Client fan-out to per-entity search endpoints** (#775): rejected — it would reuse `GET /bookings?q=` and force its active-pipeline default to change, breaking the existing bookings list; also two round trips and no server-side home for cross-type ordering.
- **Grouped `{ bookings, contacts }` response object** (#775): rejected — forces a DTO change every time the searchable set grows, fighting the architectural-openness decision.
- **Interleaving results by a cross-type relevance score** (#776): rejected — no non-arbitrary way to rank a booking against a person at two types; grouping (bookings-first) encodes the dominant intent directly.
- **Searching songs / a wider entity set in v1** (#774): rejected — song upkeep is a secondary activity and songs have no detail page to open; the wider set multiplies result-rendering and ranking work for thin value.
- **Building the palette shell by hand on `Dialog` + `Input`** (#778): rejected — it reimplements the combobox/listbox keyboard and accessibility surface `cmdk` already ships and tests, for control we don't need.
- **A bottom-sheet palette on mobile** (reusing `responsive-dialog`) (#779): rejected — the on-screen keyboard buries a bottom sheet; the palette is top-anchored instead.
- **Inline mutating quick actions** (#777): rejected for v1 — routing to existing create forms keeps the palette free of confirmation/loading/rollback machinery for no real loss.
- **`pg_trgm` / GIN index shipped with v1** (#789): rejected as premature — the `userId` index already narrows each search to a tiny per-tenant set; named as the explicit upgrade lever instead.
- **Shipping Ask scaffolding or a "coming soon" affordance now** (#781): rejected — no dead UI; only the cheap, independently-justified seams are shaped.
- **The LLM "Ask" mode (north-star Pillar 4)** and **aggregate/analytics questions**: out of scope — the assistant is its own future effort, and aggregates depend on Pillar 2 being designed plus schema changes.
