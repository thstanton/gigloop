# ADR-0049 — Series "same again" via a Copy Event action, not new-booking-form pre-fill

## Status
Accepted (2026-06-19). Implementation downstream (re-scopes #504; see follow-up issues).
Builds on ADR-0046 and ADR-0047.

## Context

ADR-0046 severed the booking-owned `Package` → `Package Template` provenance: a `Package`
is a self-contained snapshot with no reference to the template it was built from. A
documented side effect (#499) is that the new-booking form can no longer pre-fill a
series member's packages from the earliest member — there is no template identity left to
re-select. The pre-fill was removed cleanly; the question is how to restore the *user
need* ("set up the next residency booking like the last one") without re-coupling to
templates.

Two failed restorations clarified the real design:

- **Re-apply tracked templates.** Record a `Booking → PackageTemplate[]` "applied
  templates" usage list and re-apply it. Rejected: it is an *apply-log*, not a mirror of
  current packages, and it **cannot track package removal** — a booking-owned `Package`
  has no link back to its template (ADR-0046), so a package the musician *removed* on the
  earliest member would silently **resurrect on every subsequent series booking**. A
  mistake made once carries forward forever. Pruning the log on removal would require
  label-matching — exactly the silent-relabel coupling ADR-0046 exists to kill.
- **Clone the earliest member's packages into the create form.** Rejected: it sources
  packages from the earliest member while conflating two genuinely different user intents
  (below) into one over-smart form.

The insight: there are **two distinct intents**, and forcing both through new-booking-form
pre-fill is what made every restoration incoherent.

## Decision

Distinguish the intents as **three explicit actions**, and **remove the earliest-member
auto-pre-fill from the new-booking form**.

1. **Copy Event** ("exact same gig again") — a primary action in the **Series card** on the
   booking detail page (the series has no dedicated page; it surfaces contextually —
   CONTEXT). A `ResponsiveDialog` asks only for the **new date** and states plainly what is
   copied. It clones **this** booking server-side (the one whose Series card the musician is
   on — a booking they can see and have already corrected) and **never touches the
   new-booking form**.
   - **Copies (what the gig *is*):** customer, venue, booking agent, eventType, title,
     fee, notes, `travelMode`, `logistics` (whole), packages + their `PerformanceSet`s,
     music form **config**, and the same `seriesId`.
   - **Asks:** the new date.
   - **Resets (lifecycle state):** `status` → `ENQUIRY`; a fresh `portalToken`; no
     invoices / documents / communications / `musicFormResponse` / `depositReceivedAt`;
     checklist items copy but their **completion resets to pending and due dates
     recompute against the new date**.

2. **Add New Event to Series** ("same client & venue, different content") — a **secondary**
   action in the Series card (the below-the-fold pattern the Invoices/Contracts cards use).
   It opens the **new-booking form** pre-filled with the series **identity only** —
   `seriesId`, customer, venue, booking agent, carried from **this** booking via the form's
   existing **navigation-state** pre-fill — and **nothing about performance content** (no
   packages, sets, checklist, or music form). For a recurring client/venue whose set-up
   differs each time.

3. **Associate at creation** ("attach a booking I'm already making") — selecting an existing
   series directly in the new-booking form's series selector tags the booking onto the
   series and makes **no assumptions at all** (no pre-fill, not even customer — the booking's
   own customer may differ from the series billing customer, CONTEXT).

The new-booking form therefore holds **no series auto-pre-fill logic of its own**: it
pre-fills only from explicit navigation state (action 2) and is otherwise blank (action 3).
The deliberate asymmetry — dropdown selection pre-fills nothing, the card action pre-fills
identity — is because picking a series in a blank form may be an unrelated booking, whereas
"Add New Event to **this** Series" is an explicit same-client gesture.

## Consequences

- **Fully ADR-0046-clean.** Copy Event clones snapshots booking-to-booking with **no
  template reference anywhere** — the same operation ADR-0046's migration already performs.
  No applied-template tracking record, **no migration, and no ADR-0046 amendment** are
  needed.
- **The mistake-carry-forward bug is structurally impossible:** Copy Event sources from a
  concrete, already-corrected booking, not an apply-log or an abstract "earliest member."
- **Teardown:** the earliest-member series pre-fill is removed — the `seriesDefaults`
  query/effect in the form and the now-dead `series.findDefaults` /
  `findEarliestMemberBooking` surface (which still returned a `musicFormConfig` the
  frontend never consumed — the pre-existing music-form pre-fill no-op evaporates rather
  than needing to be wired). The form's **navigation-state pre-fill is *preserved*** — it
  is load-bearing for action 2 (Add New Event to Series).
- **Acceptance is implicit, so the affordance must telegraph it:** the action is named to
  make the copy explicit ("Copy Event") and the dialog states what carries across — there
  is no per-field confirmation.
- **"Most popular templates" is parked, not lost.** The `Booking → PackageTemplate[]`
  usage record (and the ADR-0046 amendment it would need) is decoupled into a separate
  future analytics/booking-builder concern — useful, but not required by this feature.
