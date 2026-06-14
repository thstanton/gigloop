# ADR-0043: Series draft invoices stay in sync with membership; issued series invoices freeze the batch

## Status
Accepted (2026-06-14). Builds on ADR-0029 (booking series as billing grouping) and ADR-0042 (invoice `Issued` state).

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
