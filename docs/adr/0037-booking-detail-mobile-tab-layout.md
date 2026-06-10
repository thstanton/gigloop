# ADR-0037 — Booking Detail: Mobile-First Tab Layout

## Status
Accepted

## Context

The booking detail page is the most information-dense page in GigMan. It combines: a checklist, on-the-day logistics (itinerary, details, venue map, notes), and a large set of admin records (people, contract, invoices, documents, packages, music form, communications).

On mobile (375px), displaying all of this as a single scrolling column buries the two most time-sensitive concerns — the checklist and on-the-day information — behind a wall of content. Users would need to scroll significantly to reach the section most relevant to their current moment in the booking lifecycle.

On desktop (768px+), a two-column layout can show the checklist permanently alongside the content it relates to, making the trade-off unnecessary.

## Decision

### Mobile: three-tab layout

On mobile, the booking detail page uses a three-tab structure below a persistent overview strip (status, date, fee, edit/portal buttons):

- **Checklist** — the checklist only
- **On the Day** — itinerary, details, venue map, notes
- **Info** — all admin records: people, series, contract, invoices, documents, packages, music form, communications

The tab structure is mobile-only (`md:hidden`). The overview strip is always visible above the tabs.

**Content grouping rationale:**
- Checklist = *action now* — the primary interface for progressing the booking (per the "contextual actions" design principle)
- On the Day = *operational now* — everything needed for day-of execution. Notes are operational (venue access, logistics cues) so belong here alongside the venue map and itinerary, not with admin records
- Info = *the admin record* — reference content the musician consults rather than acts on in the moment; deliberately a catch-all for everything that isn't action or day-of operational

Three tabs is the right number. Over-tabbing fragments navigation without adding clarity. The current volume of Info content does not warrant splitting further.

**Default tab by lifecycle stage:**

| Status | Default tab |
|---|---|
| ENQUIRY, PROVISIONAL, CONFIRMED | Checklist |
| READY, COMPLETE, CANCELLED | On the Day |

At READY, pre-gig admin is done and the musician's attention has shifted to day-of execution. Checklist is no longer the most useful landing point.

**Information density scales with available space:**

`PersonChip` (compact horizontal chips) is used in the Info tab on mobile; `PersonCard` (full border rows) is used on desktop. `ItineraryCard` and `DetailsCard` render with `hideWhenEmpty` in the mobile tab view — empty cards consume tab real estate disproportionately. On desktop they always render.

### Desktop: two-column full-scroll layout

On desktop, the page uses a `3fr 2fr` two-column grid with no tabs. The right column holds the checklist permanently visible alongside the content it relates to — no context switching needed. Vertical position expresses priority: most important content at the top of each column, reference content (notes, communications) lower down.

Tabs on desktop are not ruled out for future iterations if content density warrants it.

## Alternatives considered

- **Tabs on both mobile and desktop:** Rejected for desktop — the two-column layout already shows checklist and content simultaneously. Tabs would require clicks to reach content that can be displayed at once, wasting the available space.
- **Four or more tabs:** Rejected — splitting Info further (e.g. a Finance tab for contract/invoices) fragments navigation without meaningful benefit at current content volume.
- **Notes in the Info tab on mobile:** Rejected — notes are operational (venue access, logistics cues), not reference. Placing them with itinerary and venue map is the correct grouping.
- **Single scrolling column on mobile:** Rejected — buries checklist and on-the-day content, violating the "contextual actions" design principle.

## Consequences

- New content on the booking detail page must be placed per the grouping rationale above: action → Checklist, day-of operational → On the Day, admin record → Info.
- `hideWhenEmpty` is the standard pattern for cards in the mobile tab view.
- If the Info tab grows to a point where it is meaningfully too long on mobile, revisit the tab count — but evaluate expandable sections within Info before adding a fourth tab.
