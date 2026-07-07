# ADR-0046 — Package Template (library) vs Package (booking-owned grouping)

## Status
Accepted (2026-06-17). Implementation — including the schema rename and migration — is downstream
work; the **fee role is explicitly out of scope** and parked for P2 (see North Star → Quote
Calculator).

**Amended:** 2026-07-07 — package libraries are no longer seeded from the system defaults; the defaults
became a read-only starter catalogue. See "Amendment (2026-07-07)" below and #663.

## Amendment (2026-07-07): libraries start empty; defaults are a read-only catalogue

The original decision assumed the system-default Package Templates were **seeded into each user's
library** on first access (a lazy copy in `PackagesService.findAll`), and the onboarding rework (#478)
planned to keep "seeding the full default set in the background." During the #663 build the owner
reversed this in favour of a **customisation-first** stance:

- **A new musician's package library starts empty.** The lazy auto-seed is removed.
- **The system defaults become a read-only starter catalogue** — `GET /packages/catalogue`, served from
  the `SYSTEM_DEFAULTS` constant, never persisted. Onboarding Step 3 (and, in future, the admin Packages
  page) lets the musician base **one** real template on a starter and save it via `POST /packages`.
  Nothing is added to the library until the musician saves it.
- **`isSystemDefault`** therefore appears `true` only on legacy rows seeded before this change; templates
  the musician creates are `false`. The dashboard tips widget reads it (as "no custom package") to nudge
  a musician who has no template of their own.

Nothing else in this ADR changes: the Template↔Package distinction, provenance-severing, and the
copy-on-apply mechanic are unchanged. Legacy libraries seeded before this change keep their rows — **no
backfill** (confirmed a non-issue pre-launch: no real user data).

## Context

A `Package` historically served **double duty**: it was both a reusable per-user **library template**
*and* a live component of a specific booking. The booking link was expressed through `BookingPackage`
(a join `Booking ↔ Package`, ordered) and `PerformanceSet.packageId` (each set pointing back at the
same library `Package`). Applying a package copied its slots into editable `PerformanceSet` records,
and seeded its key moments + default genres into the booking's music form.

A package plays three roles **at build time**:

1. **Generates the sets** for the booking (saves repeating common patterns).
2. **Suggests key moments and genres** for the music form.
3. Provides a **semantic grouping of sets** — the client-facing "set container" shown in the admin UI
   and on the portal (the commercial lens of the "itinerary vs packages" principle).

A prior decision (CONTEXT, 2026-06-17) moved ownership of key moments and genres to the **music form**
— so role 2 is now pure build-time convenience. That left **role 3 as the only reason a `Package`
stayed bound to a booking**. This is the double duty, and it caused concrete problems:

- **Snapshot-vs-live inconsistency.** Sets are *copied* onto the booking (template + overrides), but
  their group's label/icon are read **live** from the library template at render time. Editing a
  template silently re-labels historical bookings' groupings.
- **Ownership muddle.** "Are a booking's sets owned by the booking or the package?" and "can a set be
  ad-hoc?" had no clean answer while `Package` was both library item and booking component.
- **Conceptual muddle.** "What's the difference between a set in a package and a set in the itinerary?"
  was hard to answer cleanly.

## Decision

Split the two roles into two distinct entities, named from the **musician's** point of view (a
musician thinks of the thing on the booking and on the portal as a "package"):

- **`Package Template`** (rename of the current `Package` model): the per-user **library builder**.
  Holds default sets (slots), suggested key moments, default genres, icon, category, notes, and an
  `enabled` flag. Used **only at apply time**. **Never linked to a booking.** A `guideFee` to support
  quoting is envisaged for P2 (directional only — see North Star; not decided here).

- **`Package`** (repurpose/rename of the current `BookingPackage`): a **booking-owned, first-class**
  entity — a **snapshot grouping of sets**, created either by applying a `Package Template` or
  ad-hoc. Carries its own `label`, `icon`, and `order`, **copied at creation and decoupled** from any
  template thereafter. This is the client-facing set container (the commercial lens).

- **`PerformanceSet`** has an **optional** `packageId` → booking-owned `Package`. A set may belong to
  a Package or be **ungrouped** (`packageId` null), rendered flat with no package container. Grouping
  is encouraged (most bookings will be assembled from Package Templates) but **never enforced** — a
  plain "four sets, no segmentation" gig needs no container. This follows the encourage-don't-enforce
  workflow principle. **No invisible/implicit container entity is created** for ungrouped sets: `null`
  is the honest representation, and the view layer renders ungrouped sets without a heading (mirroring
  the music form's "Other" key-moments bucket). The `Package` is **not** a commercial/billing unit —
  the booking fee is authoritative and invoice line items are free-form.

- **Provenance is severed.** A booking-owned `Package` keeps **no** reference to the `Package
  Template` it was built from.

- **Applying a `Package Template`** generates a new booking-owned `Package` + its `PerformanceSet`s,
  and *suggests* key moments/genres to the music form (which owns them — ADR/CONTEXT, music form).

## Consequences

- The **snapshot-vs-live inconsistency is resolved**: a booking-owned `Package` is a self-contained
  copy; editing a `Package Template` can never alter an existing booking.
- **Ungrouped sets are first-class** — a set with `packageId` null, rendered flat. Ad-hoc grouping is
  also available (a Package created without a template), but never required.
- The **"set in a package vs set in the itinerary"** question dissolves: there is one `PerformanceSet`;
  the `Package` is its commercial lens and the itinerary is its operational lens.
- The **P2 fee role now has a clean home**: a guide fee on the `Package Template` feeding the Quote
  Calculator (North Star). The booking-owned `Package` is **not** a separately-billed line item;
  quoting stays at the booking level.
- **Migration:** existing `BookingPackage` rows become booking-owned `Package`s (snapshotting label /
  icon from their source template at migration time); `PerformanceSet.packageId` is repointed. Data
  volume is low (near-greenfield).
- **Code rename (downstream):** Prisma `Package → PackageTemplate`, `BookingPackage → Package`; plus
  DTOs, endpoints (`applyFormat` and the `formats` vocabulary), `apps/web/src/types/api.ts`, feature
  components, and the `/admin/packages` library page. The legacy **"format"** terminology should be
  retired in the same sweep.
- Music form key-moment `section` is no longer tied to a live package: it defaults to the source
  `Package`'s label at pre-fill and to "Other" for independently-added moments.

## Alternatives considered

- **Keep `Package` double-duty (status quo).** Rejected — it is the direct source of the
  snapshot/live bug and the ownership/conceptual muddle.
- **Package as pure convenience; sets become a flat booking-owned list with no grouping entity.**
  Rejected — it loses role 3 (the client-facing semantic grouping) and removes the natural anchor for
  the P2 guide fee.
- **Keep the name `BookingPackage` and/or retain a live FK to the template.** Rejected — the name
  wouldn't reflect that this *is* the user-facing "Package", and a live template FK would reintroduce
  the snapshot-vs-live coupling. Severing + renaming is the clean cut.
- **Force every set into a package, using an invisible/implicit default container for "ungrouped"
  sets.** Rejected — it buys uniform "every set has a package" at the cost of a phantom singleton the
  UI must hide everywhere (grouping filters, find-or-create on first set, container lifecycle when its
  last set is deleted). A nullable `packageId` expresses "ungrouped" honestly with none of that hidden
  coupling, and matches the music form's "Other" precedent.
