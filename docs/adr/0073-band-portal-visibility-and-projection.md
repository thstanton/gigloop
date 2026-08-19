# ADR-0073 — The band portal: audience-aware visibility and a declared field projection

## Status
Accepted (2026-08-19). Charted by the wayfinding map [#814](https://github.com/thstanton/gigloop/issues/814); decided across [#816](https://github.com/thstanton/gigloop/issues/816), [#824](https://github.com/thstanton/gigloop/issues/824), [#820](https://github.com/thstanton/gigloop/issues/820). **Amends [ADR-0054](0054-unified-portal-visibility-authority.md)**, whose 2026-08-18 amendment explicitly left this question open. Companion to [ADR-0072](0072-band-roster-chairs-and-members.md) (the roster) and [ADR-0074](0074-band-communications.md) (reaching the band). Builds on [ADR-0059](0059-private-document-access.md) (private document access).

## Context

GigLoop has had exactly one portal audience: the client. ADR-0054 made portal visibility a single computed authority so the portal renderer and the admin indicator could not disagree. A **second** audience — the dep, at `/band/:token` — asks a question that authority was never shaped for: not *is this concern visible*, but *visible **to whom***.

The naïve answer is a second authority for the band portal. That is precisely the duplication ADR-0054 exists to prevent, one audience later.

The second problem is different in kind. A verdict says *whether* a concern appears. A portal also needs to decide *which fields* cross — and the client portal has always answered that by hand-picking fields at each render site. With a second audience, hand-picking becomes a leak surface: every future field added to a booking is visible-by-default to anyone whose renderer spreads an object.

⚠️ **Terminology.** ADR-0054's 2026-08-18 amendment used "audience" for a document's *ownership* — whether a booking owns the document being asked about. That gate is unchanged and remains correct. This ADR uses **audience** for its plain meaning: *who is asking*. They are orthogonal axes; a series invoice is ownership-excluded from every booking portal regardless of who looks.

## Decision

### 1. Both — split by kind of truth (#816)

This *is* the single-authority principle, applied to two different questions:

- **Runtime verdicts** → the ADR-0054 authority gains an **`audience: CLIENT | BAND`** parameter. Same pure module, same consumers, one more argument.
- **The field wall** → a **named declared projection**, `BAND_PORTAL_FIELDS`: one row per crossing field, with a `scope` column of `'roster' | 'self'`.

`roster` = what every dep sees about everyone. `self` = what the token's own member sees about themselves.

The `BandPortalView` type and a **field-by-field mapper** are derived from that table. **No spreads, no Prisma `include:` passthrough** — the #805 lesson made structural. It is consumed by **both renderers**: the portal, and ADR-0074's call-sheet PDF.

**Private by default.** Only declared crossings cross. A shape spec pins the key sets, so a field added to `Booking` is invisible to the band until someone adds a row and states why.

### 2. What crosses

**Roster scope** — booking `title` (a label the organiser wrote themselves, unlike the client's CRM name, which does not cross), date, venue name and address, the whole-day running order, roster **names and roles**, `shareWithBand` logistics including `travelPlan` and `outfits`, branding, and the **organiser's contact details**.

**Self scope** — the member's own chairs highlighted, their own response state and widget, and their **own `sessionFee`**. **No other member's fee ever crosses** — structurally impossible, because fee sits in the `self` scope and the mapper has no path from a roster row to another member's fee.

**Does not cross** — member **statuses** (the leader's scramble is not the band's business), venue CRM fields such as `parkingInfo` (the leader curates what the band needs via `shareWithBand`). **Vacant chairs cross role-only.**

Every dep therefore sees the whole day including everyone on it. That is a **conscious exposure**, falling directly out of ADR-0072's booking-wide chairs, and it is what makes the portal legible as a call sheet.

### 3. Documents: call-sheet-or-nothing, fail-closed

Document visibility for `BAND` is a **total mapping by type**, defaulting to hidden. A future document type that declares nothing is invisible to the band — forgetting is safe. Only the call sheet crosses.

### 4. The call sheet: one shared sheet, on demand, never versioned (#824)

**Shared, not per-dep.** A multi-lineup gig is a call-time *column*, not a personalisation problem — and a shared sheet stays **forwardable** to the venue, the engineer, or a dep's own dep. ⇒ **no fee on it.** A dep's own `sessionFee` reaches them through the portal's `self` scope instead.

**Generated on demand, never versioned.** Versioning was evaluated and declined: it needs a change-**trigger list** (a *missed* trigger looks authoritative while being wrong), unbounded storage with no delete path, and it serves the organiser's audit need, not the dep's on-the-day need. Decisively — the sheet exists to work **offline**, so every design leaks stale copies; versioning would only record what *would* have been served. On-demand is a strict subset of versioning's machinery, so versions stay additive later.

In its place: the link is current **by construction**, and a **self-dating footer** ("Generated {ts} — check your portal").

**A `Document` row exists only on send.** The portal download is unstored; an emailed sheet really left the building, so it lists as "Call sheet — sent 12 Aug" and is re-downloadable. One row per send, no trigger list. This requires a `CALL_SHEET` document type, which fires CONTEXT.md's *enums for closed lifecycles only* rule — hence ADR-0072 §8's `DocumentType` enum→TEXT conversion.

**No status gate on who may read it** — any non-removed member, because an `INVITED` dep deciding whether to take the gig is exactly who needs it.

### 5. Cancelled bookings gate the whole band portal

A cancelled booking renders a cancelled state band-side — identity and a banner, everything else suppressed — with the link still live. This is distinct from **removal**, where the token 404s (ADR-0072 §5).

### 6. The organiser read path

The booking response gains an explicit `band` block — chairs and members including fees and timestamps, removed members excluded. All three of ADR-0072 §6's surfaces derive from it, plus ADR-0074's Communications tab.

The **"has a multi-person lineup" signal stays out of the booking response**; the Band card derives it client-side from the `['lineup-templates']` query. The *booking-level* "this booking has band members" fact does come from the `band` block — a different question with a different answer.

### 7. Indicator treatment

No badge on logistics fields — the `shareWithBand` toggle **is** the signal. The call-sheet row reuses the existing `PortalVisibility` component ("Visible on Band Portal"). **No `ReasonCode` widening.**

## Consequences

- Adding a field to the band portal is a one-row change in a declared table plus a mapper line — and forgetting to declare it hides the field rather than leaking it.
- The call-sheet PDF and the portal cannot drift, because they render the same projection.
- A dep's link is a **bearer credential**: whoever holds it sees the roster and could answer as that member. Reversible (organiser-only reversals), identical to the invite email's exposure, and downstream of the token-only portal shape ratified at charting.
- ADR-0054's authority now takes an audience argument, so every existing call site must pass `CLIENT` explicitly — a mechanical change that makes the previously-implicit audience visible.
- A **band-facing agreement or contract** is parked, not rejected. The call sheet is shared, so it cannot carry a fee; a per-member agreement is where fee-in-a-document and immutability actually belong.
- **Song-level set lists** stay out of scope. A band-facing set list is anticipated as its own feature, expected to feed both the call sheet and the portal; the call sheet must not half-build it.

## Alternatives considered

- **A second visibility authority for the band portal** — rejected as the exact duplication ADR-0054 exists to prevent.
- **Per-dep personalised call sheets** — rejected: it destroys forwardability, and a sheet carrying one person's fee must not be forwardable.
- **Versioned call sheets** — rejected above; the offline-copy problem defeats every version.
- **Hiding other members from a dep** — rejected; chairs are booking-wide, and a dep who cannot see who else is on the gig cannot use the sheet as a call sheet.
- **Widening `ReasonCode`** for band-specific hidden reasons — rejected as unnecessary; the fail-closed type mapping needs no reason vocabulary.
