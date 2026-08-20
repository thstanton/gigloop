# ADR-0077: Series member bookings SKIP the deposit/balance checklist goals

- **Status:** Accepted
- **Date:** 2026-08-20
- **Closes:** #720 (grilled 2026-08-20)
- **Related:** ADR-0057 (goal ⊃ step checklist), ADR-0062 (re-evaluation seam), ADR-0063 (invoice transition service, #684), ADR-0029 (polymorphic Invoice ownership), ADR-0076 (goal `updatedAt` invariant)

## Context

Every booking is seeded the standard checklist, including `get_deposit_paid` and `get_the_balance_paid` (`checklist-defaults.ts:112,291`). Both goals' milestone steps gate on `invoiceExists(bookingId, isDeposit)` / `invoicePaid`, which read the *booking's own* invoices.

A series **member** booking can never hold a booking-level invoice — `invoices.service.ts:41` throws `ConflictException` on any create attempt where `booking.seriesId` is set, because billing for a series happens on the *series* invoice instead (ADR-0029/ADR-0043). The evaluator (`checklist-evaluator.service.ts`) has zero series-awareness: `BookingContext` (`checklist-rules.ts:37-51`) carries no series signal, and `SKIP_RULES` has exactly one entry, keyed on booking status (`get_contract_signed` at `READY`). The result: a member booking's deposit/balance goals sit PENDING forever with steps that structurally can never auto-complete.

Two adjacent facts shaped the decision:

1. **The member booking already surfaces series billing.** The booking detail page's Invoice section shows the series invoice as a "Series invoice" variant, so the musician isn't losing visibility if the checklist says nothing about money.
2. **The re-evaluation seam already exists and already fires post-create.** `reeval.onBookingChanged` (ADR-0062) runs after booking creation and after most booking-mutating calls — but not after `updateSeries` (`bookings.service.ts:773-804`), which handles both retroactive join and leave. That's an existing gap independent of this fix.

## Decision

**SKIP `get_deposit_paid` and `get_the_balance_paid` entirely on series-member bookings.** No series-variant goals, no series-level checklist.

The scope boundary is deliberate: the checklist exists to walk a musician through *one booking's* lifecycle, which has clear, well-ordered stages. A series has no such lifecycle — its invoice can be created long after one member's date has passed, or mid-lifecycle of a different member. There isn't enough information at the series level to helpfully remind anyone of anything, so the checklist stays out of it. Series billing progress is tracked **nowhere as a checklist goal** — only as the series Invoice's own status, visible through the existing Invoice section. No future "series checklist" is implied by this decision.

Mechanics:

1. **`BookingContext` gains `seriesId: string | null`**, sourced from the same flat `select` in `findItemsWithContext` that already carries `venueId`/`customerId` as raw FKs — consistent with the existing shape rather than pre-deriving a boolean.
2. **`SKIP_RULES` generalizes from a status-only shape (`{ keys, threshold }`) to a condition shape (`{ keys, condition: (ctx) => boolean }`)** — one skip mechanism, not two parallel ones. The existing contract entry becomes `condition: (ctx) => statusGte(ctx.status, 'READY')`; a new entry covers `['get_deposit_paid', 'get_the_balance_paid']` with `condition: (ctx) => ctx.seriesId != null`.
3. **`updateSeries` gains the missing `reeval.onBookingChanged(bookingId)` call, on both the join and leave branches** — closing the pre-existing gap so retroactive join actually re-derives the checklist (creation was already covered).
4. **No seeding-time exclusion.** The goals still seed normally; the generalized SKIP_RULES flips them to SKIPPED on the first post-create evaluation, whether that's the create-time `reeval` call or a later retroactive join.
5. **No auto-un-skip on leave.** `computeUpdates` already treats `SKIPPED` as terminal and never re-visits it, so calling `evaluate()` again on leave does not resurrect these goals. A generic per-goal "Restore" action already exists in the UI (`GoalRow.tsx`) for any SKIPPED goal, including multi-step ones — leaving a series after billing has started is rare and deliberate, and that existing control already reaches it. A bespoke un-skip path was considered and parked, not built.
6. **No backfill migration.** Existing series-member bookings with dead PENDING money goals self-heal the next time any edit triggers `reeval.onBookingChanged` for that booking. Accepted as an indeterminate but bounded window, not worth a one-off script for a data-shape-neutral state recompute.

## Consequences

- `computeUpdates` already skips terminal goals (`COMPLETE`/`SKIPPED`) *before* calling `resolveSkip`, so the new membership-based SKIP can never clobber a goal a musician already completed or already manually skipped — no special-case code needed for that interaction.
- Steps under a SKIPPED goal are not themselves updated — the existing pattern for the contract SKIP (`get_contract_signed`), now shared by the money goals; not a new precedent.
- `evaluateForEvent`'s doc comment (`checklist-evaluator.service.ts`) currently states the SKIP_RULES path "keys on booking status, which is not an InputKey the index can target" — now also true of series membership; the comment should be updated when this lands so the dormant targeted-eval path's constraint stays accurate.
- A series member booking that later leaves its series keeps SKIPPED money goals until the musician manually restores them — a one-directional default, not a bug.

## Alternatives considered

- **Series-variant goals that read the series invoice.** Rejected: the member booking already shows series billing via its Invoice section, so a checklist goal doing the same thing is redundant; it would also mean teaching the evaluator to read a different owner's (the series') invoice, which the issue's own author called high-cost/low-payoff.
- **Seeding-time exclusion** (never seed the two goals for a series member booking). Rejected: unnecessary once the SKIP condition exists in the evaluator — creation already runs `reeval.onBookingChanged` post-commit — and it has no answer for retroactive join, which must go through the evaluator anyway.
- **Auto-un-skip on leave** via a targeted method mirroring `resetItemByKey`'s invoice-void un-stick pattern. Parked rather than rejected: a real option if leave-then-rejoin-as-standalone turns out to be common, but the existing generic Restore control already covers the case, and a bespoke one-directional un-stickying path isn't worth building speculatively.
- **A one-off backfill script** for existing series-member bookings. Parked: self-healing on next edit was judged sufficient given this is a state recompute, not a data-correctness issue, and preprod runs on synthetic seed data anyway.
