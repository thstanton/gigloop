# ADR-0076: A Goal's `updatedAt` is the version of its whole subtree, and orders concurrent checklist responses

- **Status:** Accepted
- **Date:** 2026-08-19
- **Closes:** #595 (grilled 2026-08-19)
- **Related:** ADR-0057 (goal ⊃ step checklist), ADR-0062 (re-evaluation seam — `applyStateUpdates` is that seam's write), #587 (the snappy toggle this hardens), #609 (BLOCKED / dependency propagation retired)

## Context

`PATCH /bookings/:id/checklist/:itemId` does three things in sequence and **not** in one transaction (`bookings.service.ts:652-664`): write the goal's state, full-sweep `reeval.onBookingChanged`, then re-read and return the **whole** checklist. Returning the whole settled checklist is deliberate — #587 removed the follow-up refetch so a tap costs exactly one round-trip.

Because no transaction spans the write and the read, two concurrent PATCHes interleave. The second request can read the checklist *before* the first request's write lands, so its response carries a stale copy of the first goal. The client replaced its cached checklist **wholesale** with each response, so that stale copy won: the musician taps two goals, both tick, then one silently un-ticks. Nothing is persisted wrong and the next tap or page load re-syncs — the defect is cosmetic, but it reads as the app dropping a tap.

The existing defence is a client-side monotonic `toggleSeq` ref: only the reply to the *latest-initiated* tap is allowed to write the cache. It orders by **client initiation order**, which is not the order the server actually processed the writes. Worse, it is actively harmful in the two-goal case: when the first tap's reply lands last it is *discarded*, and that reply is precisely the one carrying the corrected first goal. The stale list stays.

Two adjacent facts shaped the decision:

1. **`BookingChecklistItem.updatedAt` already exists, is already on the wire** (`checklist-item-response.dto.ts:57-58`, `apps/web/src/types/api.ts:264`) and **drives no logic anywhere** — no `orderBy`, no predicate, no client read. It is a free, server-authoritative version field.
2. **It does not currently version the whole Goal.** `buildGoalUpdate` returns `null` when a Goal's rolled-up state is unchanged (`checklist-evaluator.service.ts:107`), and `applyStateUpdates` writes goal rows and step rows as separate Prisma updates. So a Step completing without moving its parent's roll-up — Step A of a three-step Goal goes COMPLETE while the Goal stays PENDING — writes **only the step row**. `BookingChecklistStep` has an `updatedAt` column but it is **not on the DTO**, so step timestamps are not on the wire at all. A Goal whose subtree changed was therefore indistinguishable from a stale copy of that Goal.

## Decision

**A Goal's `updatedAt` is the version of the Goal *and its Steps*, and the client orders concurrent checklist responses by it, per Goal.**

1. **Any write to a Step also touches its parent Goal row.** Both step-write sites obey this: `applyStateUpdates` (the evaluator path) touches the parent of every written step, deduped against Goals already receiving a state update in the same transaction; `resetItemByKey` (the invoice-void un-stick path) touches the parent Goal unconditionally rather than only when it is `COMPLETE`. Step *creation* needs nothing — steps are seeded with their Goal, so the Goal row is new anyway. Nothing deletes Steps.

2. **The client merges per Goal, newest wins.** `useBookingChecklist`'s toggle `onSuccess` no longer replaces the cached array wholesale. It walks the **incoming** array (which is authoritative for membership) and, for each Goal, keeps whichever copy — incoming or cached — carries the newer `updatedAt`.

3. **Equal timestamps keep the cached copy.** This is not an edge case; it happens on every tap. The optimistic tick in `onMutate` is a client-side change, so the cached Goal spends the in-flight window carrying a **new state with an un-bumped timestamp**. A concurrent response carrying that Goal in its old form ties — and the tie must resolve to the cached copy or the tick is reverted, which is the bug.

4. **The `toggleSeq` guard is deleted.** The version comparison subsumes it. For the same-item rapid toggle #587 built the guard for, the later write carries a strictly newer `updatedAt`, so an out-of-order earlier response loses on merit rather than on client bookkeeping — and, unlike the guard, the earlier response's *other* Goals are still allowed to settle. Two ordering mechanisms that can disagree is worse than one, and the one removed is the weaker authority.

5. **Scope is the toggle response only.** Every other cache-writing path (`invalidateQueries` from invoice actions, sends, contract updates, add-item, status change) triggers a full refetch rather than writing the cache, and refetches keep replacing wholesale.

## Consequences

- `updatedAt` on `BookingChecklistItem` stops meaning "when this Goal row last changed" and starts meaning "when anything in this Goal's subtree last changed". Nothing read it before, so nothing breaks — but it is now load-bearing.
- **The invariant is fragile in exactly one way:** a future step-writing path that forgets to touch its parent Goal silently reintroduces the defect — no type error, no failing type check, and the symptom self-heals on refresh. The band-member checklist work (#899–#902) adds step states and is the next path that must obey it. The guard is therefore a **test** asserting that writing a Step bumps its parent Goal's `updatedAt`, plus a comment at `applyStateUpdates` where the invariant is actually breakable. The ADR records the *why*; the test is what fails.
- A tap's reply can now settle Goals it did not touch, where before a non-latest reply was thrown away entirely. This is the intended repair.
- No schema change, no DTO change, no API contract change. The fix is one repository method, one un-stick path, and one `onSuccess`.

## Residuals (accepted)

- **Millisecond ties.** Prisma sets `@updatedAt` in JavaScript, so two genuine writes inside the same millisecond carry identical timestamps and resolve to first-arrival. Reaching this needs two taps under 1ms apart; a fast human double-tap is ~50ms. It degrades to the pre-fix behaviour, never worse, and clears on the next tap or load.
- **The refetch race.** A tap in flight while an unrelated action (invoice marked paid, email sent) invalidates the checklist can have that refetch read pre-tap and land post-reply, replacing wholesale and losing the tick. Rarer than the two-tap case — it needs a tap to coincide with another action completing — and not what #595 reports. Out of scope by decision 5.

## Alternatives considered

- **Put `updatedAt` on the Step DTO and compare Goal-and-Steps deeply on the client.** Rejected: widens the API contract and moves knowledge of the Goal⊃Step relationship into a client-side deep comparator, to buy exactly what touching the parent row buys for three lines in one already-transactional method.
- **A dedicated server version token** (a counter column, or an envelope `{items, version}`). Rejected: the issue's own proposal, but it needs a schema change *and* forks the response shape — the endpoint returns a bare `ChecklistItem[]`, so a version would have to arrive as an envelope, a per-item field, or a header, each a contract change rippling through every checklist consumer. `updatedAt` already carries the ordering information for free.
- **Accept step-only changes being dropped** (goal-row versioning without the parent touch). Rejected: leaves a narrower version of the same defect that, unlike today's wholesale replace, never self-corrects from a subsequent response.
- **Keep the `toggleSeq` guard behind the merge.** Rejected: the guard discards the corrective reply before the version comparison ever sees it, so the two-goal case stays broken.
- **A backstop refetch after each toggle.** Rejected outright — it is exactly what #587 removed, and re-adding it trades the one-round-trip win for a race that per-Goal ordering closes without it.
