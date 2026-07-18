# ADR-0062: Checklist re-evaluation goes through one delegated seam; event bus and targeted containment stay deferred

- **Status:** Accepted
- **Date:** 2026-07-18
- **Supersedes the proposal in:** #685 (grilled 2026-07-18)
- **Related:** ADR-0057 (goal ⊃ step checklist), ADR-0061 (same shape — build the convention, park the heavier seam behind a named future trigger), ADR-0025 (no long-lived branches / dark-launch)

## Context

The checklist is a *derived view* of a booking: when a business event changes the booking (an invoice is created/sent, an email goes out, a contact's email changes, a date moves, a set is added…), the booking's Goals must be re-derived. This was done by 23 mutating methods across 6 modules, each hand-writing the same idiom after its real work:

```ts
await this.evaluator.evaluate(bookingId).catch(() => {});
```

Three things were copied at every site: the **trigger**, the **silent swallow** (a checklist failure must never fail the user's primary mutation), and the knowledge that **full-sweep `evaluate()`** is the method to call. A new mutating path that forgets the poke silently leaves Goals stale; one that copies it wrong (drops the `.catch()`) could start failing the user's mutation on an unrelated checklist bug. The swallow being fully silent also meant a real re-derivation failure vanished without trace.

Two adjacent facts shaped the decision:

1. **A dormant containment path already exists.** `evaluateForEvent(bookingId, changedInputs)` and its inverted-index machinery (`affectedKeys`, `goalIsAffected`, `INVERTED_INDEX`, the predicate `inputs` metadata) shipped with the goal ⊃ step evaluator (#619) but have **never had a production caller**. Verified from git: it was born dormant — at introduction the targeted and full-sweep paths were behaviourally identical, so migrating call sites bought nothing observable, and the follow-up containment pass was deferred and never taken. It is unused for structural reasons too: it demands the caller enumerate `changedInputs` (which full-sweep does not), and status/date-driven triggers *cannot* use the index at all (the `SKIP_RULES` path keys on booking status, which is not an `InputKey`), so it could never be the sole path.

2. **The tenant/consumer model is about to grow.** Band-member accounts (north-star Wave 2, expected within ~2 months) are likely to introduce multiple independent reactions to "a booking changed" — the point at which a genuine event bus earns its keep.

## Decision

**Introduce one delegated re-evaluation seam; do not build an event bus, and do not wire or delete the dormant containment path.**

1. **The seam is a wrapper, not a bus.** A single injectable `ChecklistReevaluator` in `checklist/` exposes `onBookingChanged(bookingId)`. It wraps full-sweep `evaluate()`, owns the error policy in one place, and is `await`ed by callers — preserving today's synchronous semantics exactly (a read immediately after the mutation still sees fresh Goals). The 22 request-path call sites across bookings/portal/invoices/contacts/communications delegate to it; none still hand-writes the idiom.

2. **Error policy: log-and-swallow.** The wrapper catches, logs at `warn` with the `bookingId`, and never rethrows. The primary mutation always succeeds; a previously-invisible failure is now diagnosable. This is the only behaviour change (log lines; no response/data change).

3. **The standalone `seed-checklists` script stays on direct `evaluate()`.** It runs outside Nest DI and deliberately does *not* swallow — a seed script should fail loudly. Routing it through the swallow-and-log wrapper would hide seed failures.

4. **Keep the containment path dormant, documented.** `evaluateForEvent` + the inverted index are neither wired nor deleted; their doc comment is rewritten to state they are intentionally-reserved infrastructure. If targeted containment is ever measured worthwhile, its correct activation point is *inside the seam* (decide "targeted where safe, full-sweep for status/date" once), **not** the call sites — pushing `changedInputs` back onto callers is exactly the coupling the seam removes.

5. **Park the event bus.** `onBookingChanged(bookingId)` is precisely the method a future `@OnEvent('booking.changed')` listener will wrap, so call sites do not change when a bus arrives. Revisit once band-member support gives a second consumer.

## Consequences

- One trigger, one error-policy home; a forgotten poke becomes a one-liner with the right semantics baked in.
- No new dependency (no `@nestjs/event-emitter`) and zero observable behaviour change beyond added log lines.
- The dormant containment infra is retained (tested, isolated) for a near-term, named future need rather than deleted-and-rebuilt; its intent is now recorded in-code so it stops reading as an accidental no-caller method.
- Re-evaluation semantics stay synchronous, which the app relies on in at least one place (`updateChecklistItem` re-evaluates *then* re-reads to return a settled checklist in one round-trip).
- **Reversibility:** switching to a bus later is a change inside `ChecklistReevaluator` + one listener, not a call-site sweep. Deleting the dormant path later is a clean removal. Nothing here forecloses either.

## Alternatives considered

- **Event bus now (`@nestjs/event-emitter`).** Rejected: needs a new package, and NestJS listeners are fire-and-forget async by default — the mutation would return before Goals re-derive, a real consistency change against the "no behaviour change" intent. Single consumer today; the emitters already depend on the evaluator directly. Deferred to the band-member wave.
- **Wire up `evaluateForEvent` (targeted containment now).** Rejected: pushes `changedInputs` knowledge back onto every call site (the coupling the seam removes), can't handle the status/date triggers that dominate the sites, and optimizes an unmeasured cost (full-sweep re-derives only one booking's non-terminal Goals).
- **Delete `evaluateForEvent` and its index.** Reasonable under strict YAGNI, but it is isolated, tested infra for a named near-term direction (band members). Kept and documented instead; delete if that direction is abandoned.
