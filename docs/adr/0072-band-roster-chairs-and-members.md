# ADR-0072 — The band roster is two entities: the chair and the member

## Status
Accepted (2026-08-19). Charted by the wayfinding map [#814](https://github.com/thstanton/gigloop/issues/814); decided across [#815](https://github.com/thstanton/gigloop/issues/815), [#825](https://github.com/thstanton/gigloop/issues/825), [#826](https://github.com/thstanton/gigloop/issues/826), [#829](https://github.com/thstanton/gigloop/issues/829), [#819](https://github.com/thstanton/gigloop/issues/819), [#820](https://github.com/thstanton/gigloop/issues/820), [#823](https://github.com/thstanton/gigloop/issues/823). Companion to [ADR-0073](0073-band-portal-visibility-and-projection.md) (what a dep may see) and [ADR-0074](0074-band-communications.md) (how the organiser reaches them). Extends [ADR-0046](0046-package-template-vs-booking-owned-package.md)'s template→instance symmetry. Leaves [ADR-0061](0061-tenant-scoping-convention-over-seam.md)'s parked seam parked — see §7.

## Context

North-star Pillar 3 sketched per-booking band members as a single join table: a booking, a contact, a role, a fee, a token. Charting that sketch broke it twice.

A gig is not one lineup. A wedding is a ceremony trio, a reception duo and an evening five-piece — the same booking, different people on stage at different times, and one person often in several of them. A single roster row per person cannot say *which parts* they play; a single row per part cannot say *who has confirmed*, because a person confirms once, not once per set.

And a lineup is a thing the musician **has**, not something they retype per booking. "My five-piece" is as reusable as a package template, and `PackageTemplate` → `Package` already models exactly that shape.

## Decision

### 1. A band member *is* a `Contact` (#815)

No new person entity. A band member is a `Contact` with `primaryRole = BAND_MEMBER` — a **filing label, not a constraint**: the roster row stays authoritative, and any contact can be rostered. `Contact.primaryBandRole` records their instrument as *identity* ("Dave is a sax player"), distinct from §4's declared instruments, which record *capability*.

Roster rows join the three existing FKs that block contact deletion, so `countBookings` returns a 409 for a contact who is only on a roster.

### 2. Two entities: the chair and the member (#826)

This is the load-bearing decision, and it reverses the single-table shape #825 had assumed.

- **`BookingBandChair`** — a *seat in a segment*. Carries `role`, `order`, an optional `packageId`, and a **nullable `memberId`**.
- **`BookingBandMember`** — a *person on this gig*. Carries `contactId`, `bandPortalToken`, `status`, `isSelf`, `sessionFee`, and the lifecycle timestamps.

The split follows what varies with what: **role, segment and call time are per-chair; token, invitation, confirmation and fee are per-person.** Dave plays sax in the ceremony and the evening set — two chairs, one member row, one link, one fee, one confirmation.

**A vacancy is `chair.memberId = null`** — a first-class thing the musician looks at, not an absence. The decisive consequence: **assignment never creates or destroys a row, it sets a field.** Under the single-table model, filling a second sax chair with the person already in the first would have to *collapse two rows into one*, and vacating would have to split one back into two.

**Call times are derived**, never stored — each segment's earliest `PerformanceSet.startTime`. A package-less booking degenerates to chairs with a null `packageId`: one code path, no special case.

### 3. Lineups are templates, applied not referenced (#825)

`LineupTemplate` → `LineupTemplateSlot`, symmetric with `PackageTemplate` → `PackageTemplateSlot` per ADR-0046. Applied, a lineup **is** the chairs, exactly as a package's sets are its `PerformanceSet` rows. Provenance is severed: `Package` keeps a `lineupName` snapshot, not an FK.

`PackageTemplate` gains a **nullable** default-lineup reference — applying a package auto-applies its lineup, and the musician can override. The library is a tab on `/admin/packages`.

Roles are **free text** with type-ahead derived from existing slots and instruments, and **soft matching** in the picker — a hard filter breaks on `Sax` versus `Saxophone`.

The musician is an **optional `isSelf` row**, so "five-piece" yields four vacancies, not five. Optional because a leader may send a band they do not play in.

### 4. Dep attributes live on the role-agnostic `Contact` (#829)

Following the existing venue-specific and booking-agent-specific field blocks: declared `instruments` (a free-text tag list sharing one soft-matched vocabulary with chair roles), location via the **existing** address autocomplete and lat/lng, and free-text `travelNotes` / `equipmentNotes` / `outfitNotes` / `availabilityNotes`. Organiser-private commentary stays in `Contact.notes`.

**Proximity is haversine at query time**, dep↔venue — a ranking aid, never a hard filter. No API, no background job.

**Availability is notes only.** Structured availability is deferred to dep accounts, because structured data without its maintainer lies confidently.

Two paired `LOGISTICS_FIELDS` rows are added — `travelPlan` (the open plan: "Emily by train, Mike collects Phil") and `outfits` (the *implementation* of the client's `dressCode` *spec*) — both `shareWithBand: true`, with the profile→logistics pairing declared as data.

### 5. Lifecycle: four statuses, soft removal (#819)

`ADDED → INVITED → CONFIRMED | DECLINED`, as a coverage-guarded `as const satisfies` table. `ADDED → CONFIRMED` is legal — confirming on someone's behalf must not fabricate an `INVITED` that never happened.

**There is no `REPLACED` status.** The person's *answer* and what the organiser *did to the roster* are separate facts. Replacement is **soft removal**: `removedAt` plus a frozen status, with "replaced" derived. The `/band/:token` guard rejects removed rows, so **the old link dies at removal**; a re-invite is a fresh row with a fresh token.

All reversals are **organiser-only**. The portal response is one-shot.

### 6. Three surfaces, divided by question (#820, #815)

- **Itinerary** (On the day) — *who plays what, and when*. Rendered inline under each package header, role plus derived call time, vacancies in place. No click.
- **Band card** (Info) — *who these people are, how to reach them, who has answered*. A **directory**, grouped by answer (Confirmed · Waiting on · Still to sort · Chairs to fill) so availability is the structure rather than a badge. Tapping a player opens `PersonChip`'s existing popover.
- **Band sheet** — *change something*. One row per **member**, segments as chips, unfilled chairs in their own block.

The chair/person split turned out to be a split between **surfaces**: segment grouping won in the Itinerary, person grouping won in the sheet. All three derive from one `band` block on the booking response.

The roster is available at **any lifecycle stage, with no implied order**, and never appears in New Booking or the Builder — preserving ADR-0047's atomic create and ADR-0066's create-mode exclusion.

### 7. Multi-tenancy is untouched — ADR-0061's seam stays parked

v1 introduces **no authenticated dep actor and no shared ownership**. `BookingBandMember` inherits the organiser's `userId`; `/band/:token` bypasses Clerk exactly as `/booking/:token` does. Every query predicate remains `userId`-equality.

ADR-0061 parked the #683 structural tenant-scoping seam pending *"the band-member ownership model"*. **That trigger did not fire.** Band members are Contacts owned by the organiser, reached by bearer token — there is no second principal and no cross-tenant read, so the seam's predicate is unchanged and #683 stays parked.

### 8. Schema: one additive migration, shipped first (#823)

Four new tables, nine nullable columns, one widening `DocumentType` enum→TEXT conversion (following `20260526000000_enum_to_string_event_type_song_genre`). Nothing narrowing, nothing `NOT NULL` on existing data.

Most of the vocabulary work needs **no migration at all** — `Contact.primaryRole` and `BookingChecklistStep.state` are already `String`, per #787's String-over-enum convention.

`bandPortalToken` is `@unique @default(uuid())`, matching `Booking.portalToken` exactly.

The migration ships as its **own PR, merged before the feature branch starts** — the fleet's one-schema-PR lock permits one in-flight migration PR, and carrying it on a multi-week feature branch would hold that lock for the feature's life.

**`Contact.email` stays optional, enforced nowhere.** Requiring it would exclude the dep who only uses WhatsApp — the exact person ADR-0074's copy-paste channel exists for.

## Consequences

- One person, one link, one fee, one confirmation — however many segments they play.
- Assignment and vacating are field writes, so a chair's identity survives every roster change and Copy Event can carry the structure with statuses reset and fresh tokens.
- Every dep sees the whole day including the full roster (ADR-0073) — a conscious exposure that falls out of chairs being booking-wide.
- A fourth roster-shaped surface is now cheap to add and must be resisted; ADR-0073 and ADR-0074 each justify theirs against the three above.
- A per-role guide rate, `Contact.defaultSessionFee` and `PackageTemplate.guideFee` are **out of scope** — each exists only to reverse-engineer a quote, so they belong to the Quote Calculator's own design.

## Alternatives considered

- **One roster table** (#825's original) — rejected once multi-segment gigs were charted: filling a second same-role chair would collapse two rows into one, and role/call-time could not vary per segment while confirmation stayed per person.
- **Storing call times on the chair** — rejected; they are derivable from `PerformanceSet.startTime`, and a stored copy drifts the first time a set moves.
- **A dedicated `BandMember` entity separate from `Contact`** — rejected; it would fork the address book, duplicate deletion rules, and break the future account-linkage hedge that email is the join key.
- **Structured availability in v1** — rejected; without the dep maintaining it, stale availability is worse than none.
