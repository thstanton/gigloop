# ADR-0081 — A Lineup is a booking-owned instance, not a tag on its chairs

## Status

Accepted (2026-08-22). Arises from #979, which asked a narrow question — *should band setup be
reachable from the Booking Builder?* — and surfaced a structural gap underneath it.

**Amends ADR-0072 §2, §3 and §6** (the chair's segment column, the lineup-application mechanism, and
the Builder/New-Booking exclusion). **Amends ADR-0053 item 3** (the create form's Packages section
gains one control). **Related:** ADR-0046 (Package Template vs booking-owned Package — the pattern
this generalises), ADR-0047 (atomic booking creation), ADR-0066 (the create-mode exclusion),
ADR-0073 (band portal projection — a downstream consumer).

## Context

#879 shipped the band roster: `BookingBandChair` rows hanging directly off the Booking, each tagged
with a nullable `packageId` naming the segment it plays. A `LineupTemplate` applied to a booking
became those chairs, and the template's label was snapshotted onto `Package.lineupName`.

Walking four booking journeys against that model found one it cannot express.

> **Drinks and Reception (two packages), played by one four-piece.**

The model records four seats in Drinks and four seats in Reception. Whether that is *one* band of
four playing twice or *two* bands of four is not stated anywhere — it is left for a human to infer
from the names once the chairs are assigned. The musician sees eight vacancies for a four-piece,
reads the segment suffix on each badge to de-duplicate them mentally, and then searches for and
seats each player twice.

**There is no "the band on this gig" object.** And ADR-0072 §3 already asserts the fix without
implementing it:

> Applied, a lineup **is** the Chairs, exactly as a Package's sets are its Set rows.

But a `PerformanceSet` has a `packageId` parent: the `Package` is a real booking-owned row carrying a
severed-provenance label snapshot (ADR-0046). A `BookingBandChair` has **no lineup parent**. The
symmetry the ADR claims is not built, and `Package.lineupName` is its vestige — a lineup's label
bolted onto a neighbouring entity because there was nothing else to hang it on.

Three further defects fall out of the same missing row, each of which had looked like an independent
bug:

- **`createWithPackageTemplates` silently drops `defaultLineupTemplate`.** Picking a package template
  in New Booking gives you its sets but never its lineup; applying the *same* template post-create
  gives you both. Same declared intent, two outcomes, no message.
- **The Band sheet's Segment picker defaults to `Whole day`** on every booking, including one whose
  chairs are all per-segment. Applying a lineup without noticing the picker produces a third segment
  grouping that matches no package and renders nowhere in the Itinerary.
- **The template's default lineup can only be overridden by undoing it.** A musician whose lineup is
  part of the price negotiation must either accept chairs they have not agreed (silencing the
  checklist's `Choose a lineup` prompt) or keep a *second* package template with no default. Three
  formats × two lineups + a null-lineup twin per format is nine library entries for three products,
  each with its own drifting copy of the set structure.

## Decision

### 1. The pattern, stated once

> **A library template applied to a booking becomes a booking-owned *instance* row with severed
> provenance, and its detail hangs off that instance — never off the Booking directly.**

Three parts, and the third is the one #879 skipped:

1. **The instance row exists** — `PackageTemplate → Package`, not merely its children.
2. **Provenance is severed** — the instance snapshots what it needs (label, icon) and holds no FK
   home, so editing or deleting a library entry never rewrites a gig that already happened
   (ADR-0046).
3. **Children hang off the instance** — `PerformanceSet.packageId`, and now `Chair.lineupId`.

Skip (3) and the relationship has nowhere to live, so it is smeared across the children
(`chair.packageId`) or bolted onto a neighbour (`Package.lineupName`). Both are in the code today and
they are the same defect wearing two hats.

The corollary, which is what #979's journeys proved: **only an instance can be pointed at.** "These
two segments, that one band" needs a row on both ends of the link.

The musician's library is exactly the two tabs of `/admin/packages` — Packages and Lineups — so the
pattern is bounded, not speculative. A third library type inherits one shape to copy.

### 2. `Lineup` is the booking-owned instance

Named `Lineup`, mirroring `PackageTemplate → Package` precisely. The glossary sentence reads straight:

> A Booking's roster is one or more **Lineups**; each Lineup plays one or more segments and holds
> **Chairs**; a Chair is filled by a **Band member**.

This deliberately breaks the `BookingBand*` prefix `#879` established. When a naming *habit* and a
structural *pattern* conflict, the pattern wins — `Package` is not `BookingPackage`, and the two
halves of one library should not be named by two different rules.

### 3. Chairs move to the Lineup; members stay on the Booking

`BookingBandChair.lineupId` replaces `packageId`. **`BookingBandMember` stays booking-scoped.** A
musician playing the ceremony solo and the reception with the seven-piece holds chairs in two
Lineups but remains **one person, one link, one fee, one confirmation** — ADR-0072 §2's central
invariant, unchanged. Only half the roster moves.

### 4. A Lineup plays one or more segments

A many-to-many between `Lineup` and `Package`. "One four-piece playing Drinks and Reception" is one
Lineup, four Chairs, two links — four vacancies, four searches, four assignments.

**The `Whole day` magic null retires.** A lineup linked to every segment plays the whole day; a
booking with no packages has a lineup linked to none. Both are the same rule rather than a nullable
column with a special-cased meaning, and the Segment picker's misleading default has nothing left to
default to.

`Package.lineupName` retires to `Lineup.label`, which is where the snapshot belonged.

### 5. The template's default lineup is a pre-selection, overridable at the point of use

`PackageTemplate.defaultLineupTemplateId` remains the **only** standing binding — there is no
user-level "usual lineup", because a second declaration of the same intent needs a precedence rule
that is wrong in at least one direction (a musician who plays weddings as a five-piece and restaurant
gigs solo wants *no* lineup on the restaurant template; a fallback would read that as "unset, so use
my usual").

But **a default you can only override by undoing is not a default — it is an assertion.** So each
selected package template in the New Booking form carries a lineup select — the musician's lineups
plus **"Decide later"** — pre-filled from the template. Journeys that want the default tap nothing;
the negotiating musician taps once; nobody keeps a duplicate template.

Templates that select the same lineup share **one** `Lineup` instance linked to both segments. That
is the direct expression of "same band, both segments", not a heuristic.

**This amends ADR-0053 item 3**, which froze create's Packages section as "template-multiselect
only". Item 3's purpose is Story 39's lean enquiry capture, and a pre-filled select sitting under a
chip the musician has already tapped adds no field to the form's default state and no step to the
fast path. The amendment is recorded rather than smuggled.

### 6. Create honours the declared lineup

`createWithPackageTemplates` stops dropping `defaultLineupTemplate`. The Lineup and its chairs are
written **inside the existing transaction**, alongside the sets loop — written inline against `tx`,
never by calling the apply path, which opens its own `$transaction`.

ADR-0047 is untouched: the atomic unit gains rows, not a second write. ADR-0066's create-mode
exclusion is likewise untouched — it forbids a *contact `PATCH`* firing from inside the atomic POST;
chairs are inert (`memberId: null`, no member row, no `bandPortalToken`, no fee, no email) and
belong to the booking being created. Copy Event has carried a full roster at t=0 since #879, so the
invariant was never "no roster at creation" — only "no roster **UI** in the create form", which this
preserves: create gains a *choice*, never an editor.

### 7. `Choose a lineup` completes on chairs existing

#900's precondition step completes when the booking has chairs. "Decide later" produces none, so the
musician who genuinely has not decided is still prompted — the correct behaviour arrived at through
the mechanism rather than through a second "the musician looked at this" fact that would go stale and
lie.

### 8. The Booking Builder gains a Band section

ADR-0072 §6 excluded the roster from New Booking **and** the Builder, "preserving ADR-0047's atomic
create and ADR-0066's create-mode exclusion". Both rationales are about the *create* path. Neither
can reach the Builder, which is a post-create, self-saving, incremental-`PATCH` surface. The Builder
half of that exclusion was justified by reasoning that never applied to it.

The codebase already carries the rule, unwritten: **having an atom is what makes a concern
Builder-shaped.** Every atom — Overview, People, Venue, Itinerary, Details, Music — is composed
twice, once by the Builder and once by its quick-tweak sheet. `BandAtom` has the sheet half and not
the other, and is the sole exception. The genuinely transactional band surfaces (`ContractSheet`,
`UploadDocumentSheet`) have no atom at all.

So the Builder composes `BandAtom` as a further section. Seating a player is a fact about what the
gig *is* — it belongs beside what is played and where — while inviting and chasing are transactions
that already have a home in the checklist's per-person pairs (#900). The completeness rail needs no
Band predicate: only People, Venue and Itinerary report a status; the remaining concerns resolve to
`null`, so nothing collides with #899–902.

## Consequences

- The commonest journey — one band, whole gig — stops costing double. Four chairs, four fills,
  instead of eight of each. This is structural, not a UI grouping trick.
- **Rework on a merged tranche.** #879 (PR #970) merged 2026-08-21. It has never been promoted to
  prod — `v0.8.0` was tagged 2026-08-20, before the merge — so it exists only on preprod's synthetic
  data behind a default-off `FEATURE_BAND_MEMBERS`. There is no production data to migrate and no
  expand/contract obligation. This is the cheapest moment the change will ever be available; once
  dep portals and call sheets are projecting chairs in prod, it is not a change anyone would make.
- **#880 (band portal) is in flight against the old shape.** `band-portal-fields.ts` projects
  `chair.packageId` to the wire and `BandGigSheet` renders from it. Re-pointing the projection is
  mechanical — the portal's questions (who is playing, when is my call, what is the running order)
  do not change — but it is real work on freshly-written code, and #893's call sheet is unbuilt.
- Three separately-reported defects close as one: the dropped default lineup at create, the
  `Whole day` picker default, and the library explosion forced by an un-overridable default.
- Journey 4 gains a home for a prompt it lacked: "a Lineup lost a segment" is a nameable event, so
  the session-fee revision those players need has somewhere to hang. (Deferred, not built here.)
- **Roster defaults — the same *people* every time, not just the same roles — remain out of scope.**
  A Lineup is the shape; filling it is per-booking. Revisit when the P2 collaboration pillar lands.
- **Quote-per-lineup stays out of reach and out of scope.** One Booking holds one `fee`, so it cannot
  represent two competing quotes; that is the Quote Calculator's problem (`docs/north-star.md`), not
  the roster's.

## Alternatives considered

- **A chair plays many segments** (`packageId` → `packageIds[]`). One column, far cheaper, and it
  does fix the four-chairs-not-eight problem. Rejected: it still has no "the band" object, so two
  separate bands that happen to play the same two segments stay indistinguishable from one band of
  eight; `lineupName` remains on the wrong entity; and removing a segment becomes a silent array edit
  rather than a legible event. A half-step that gets rewritten the moment the portal and call sheet
  project the roster.
- **UI-only regrouping** — leave the model alone and group vacancies by person-shape in the Band
  sheet, mirroring the member block above it. Cheapest of all. Rejected: it makes the sheet read
  correctly about a booking that still records two bands, and the Itinerary, portal, call sheet and
  checklist would each need the same compensation independently.
- **A user-level default lineup** (`UserProfile.defaultLineupTemplateId`) as a fallback when no
  package supplies one. Rejected — see §5: a second declaration of one intent, needing a precedence
  rule that is wrong in at least one direction. The Band sheet already covers the package-less
  booking.
- **Keep create read-only and make undoing cheap** (a "clear this segment" action on the Band sheet).
  Rejected: every negotiated booking would begin by un-asserting something the system had already
  reported to the checklist as a decision.
- **Requiring an explicit "touch" for `Choose a lineup`.** Rejected: it would nag the majority whose
  template lineup is simply correct, in order to serve the minority still negotiating — who are
  already served by "Decide later".
- **Naming it `BookingLineup`** (consistent with `BookingBandChair` / `BookingBandMember`) or
  **`BookingBand`** (the musician's own word). Rejected — see §2. `BookingBand` also reads oddly for
  the mixed booking, which would hold "two bands" when the musician would say they are doing the
  ceremony solo and the reception with the seven-piece.
- **Deferring the whole change until after the band tranches ship.** Rejected: the three dependent
  tranches (#880 portal, #881 comms, #882 checklist) are exactly what would make it expensive, and
  two of the three are unbuilt today.
