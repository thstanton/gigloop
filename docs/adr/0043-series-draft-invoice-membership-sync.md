# ADR-0043: Series draft invoices stay in sync with membership; issued series invoices freeze the batch

## Status
Accepted (2026-06-14; amended 2026-08-18 — cancellation is a reconcile trigger, line ordering, zero-line drafts cannot be issued; see below). Builds on ADR-0029 (booking series as billing grouping) and ADR-0042 (invoice `Issued` state).

## Context

A [[BookingSeries]] invoice auto-generates one line item per member booking at creation time (`bookings.map((b, i) => ...)`). But once the invoice exists, **membership changes were ignored** — adding or removing a booking from the series did not adjust the invoice's line items. The musician could add a date to a residency and the draft invoice would silently under-bill.

ADR-0042 establishes the principle that a **`Draft` is a live working document** and an **`Issued` invoice is frozen**. A draft series invoice that ignores membership is the "draft that lies" problem in another form.

Two complications shape the fix:
- Series line items are **fully editable** — the musician can change a line's amount (e.g. an agreed discount) or add **custom lines** (travel, PA hire). A naive "membership changed → wipe and regenerate" would destroy those edits on every change.
- `InvoiceLineItem` had **no link back to its source booking** — lines were generated positionally only.

## Decision

### Draft series invoices reconcile against membership

While a series invoice is a **`Draft`**, its line items stay in sync with series membership by **reconciliation, not regeneration**:

- Add a nullable **`sourceBookingId`** to `InvoiceLineItem`. Auto-generated series lines carry it; custom lines have it `null`.
- **Booking added to the series** → append one line (`sourceBookingId` set; description/amount from the booking).
- **Booking removed** → delete the line whose `sourceBookingId` matches.
- **Custom lines (`null`) and any manual edits to existing lines are never touched.**
- Reconciliation is triggered by **membership** changes only. A member booking's *own* fee/sets changing after it joins does **not** retro-push onto its line (a noisier concern, deferred — flagged, not implemented).

### Issued series invoices freeze the batch

Once the series invoice is **`Issued`** (or beyond), the billing batch is **closed**. Adding or removing a series member is **blocked** while a non-`Draft` series invoice exists — the API rejects the membership change with a clear error directing the musician to void the invoice first. This prevents a newly-added booking from silently going unbilled against an already-committed invoice.

Net invariant: **`Draft` = open & syncing; `Issued` = closed & frozen, membership locked.**

## Alternatives considered

- **Full regenerate on every membership change.** Simple, but destroys manual line edits and custom lines. Rejected — worse than the original bug.
- **No auto-sync; show a "membership changed — refresh lines?" prompt with a manual re-sync button.** Less surprising, but leaves the draft stale by default and adds a manual step the musician will forget. Rejected in favour of automatic reconciliation, which is safe because edits are preserved.
- **Allow membership changes after issue and silently mutate the issued invoice.** Rejected — violates the "issued is committed/immutable" model from ADR-0042 and risks an under-billed legal document.
- **Warn (not block) on membership change after issue.** Rejected — the user chose a hard block; a warning is too easy to click through for something that corrupts a billing batch.

## Consequences

- **Schema:** add nullable `InvoiceLineItem.sourceBookingId` (Prisma migration — requires confirmation before running). Existing lines have it `null`, which correctly means "treated as custom / not reconciled."
- The reconciliation hook lives wherever `Booking.seriesId` is mutated (series membership add/remove); it must locate the series' `Draft` invoice (if any) and reconcile.
- The block-when-issued guard is a new precondition on series membership mutation, complementing the existing retroactive-assignment guards (ADR-0029).
- **Edge — series emptied:** removing the last member leaves a draft series invoice with zero lines. It is left in place for the musician to delete; not auto-deleted.

---

## Amendment (2026-08-18) — cancellation reconciles, and the guard now has something to guard

Two corrections from the series-invoice sweep (see [ADR-0069](0069-owner-agnostic-invoice-operations.md)).

**Cancellation is a reconcile trigger.** The original decision scoped reconciliation to membership changes only, on the reasoning that a member booking's *own* fields changing should not retro-push onto its line. Booking **status** turns out to be the exception: `findMemberBookingsForInvoice` had no status filter, so a `CANCELLED` member booking was billed a line at creation, and cancelling one after the draft existed left its line in place. Both silently over-bill, which is the "draft that lies" failure this ADR was written to kill.

Amended: `CANCELLED` member bookings are excluded at creation, and cancelling a member booking **reconciles the draft series invoice** exactly as leaving the series does — its traced line is removed. Custom lines and manual edits are untouched, as always. Un-cancelling re-adds the line by the same path. Reconciliation remains DRAFT-only; an issued batch stays frozen, and the existing block on membership mutation already prevents the awkward case.

This is a deliberate narrow widening of the trigger set — from *membership* to *membership and billability* — not an opening of the door to field-level sync. A member's fee or sets changing still does not retro-push onto its line; that remains flagged and unimplemented.

**The edit-preservation guard was protecting an empty set.** This ADR's central premise — reconcile rather than regenerate, so manual line edits and custom lines survive — assumed both were reachable. They were not: no route to edit a series invoice's line items has ever existed on either the API or the client (ADR-0069 has the full account). The `sourceBookingId !== null` filter was correct and inert. Nothing about the reconciler changes; ADR-0069 simply gives it something real to defend for the first time.

**Ordering.** `syncMemberJoin` appended at `maxOrder + 1`, so a back-dated booking joining later landed at the bottom of a client-facing document whose create-time lines are date-ordered. Auto-generated lines are now inserted in date position; custom lines keep their place at the end.

**Zero-line drafts.** Leaving a drained draft in place for the musician to delete (rather than auto-deleting it) stands. What changes is that it can no longer be **issued** — a numbered £0.00 invoice is not a document any musician means to send, and the PDF renders one perfectly happily, header row and all.
