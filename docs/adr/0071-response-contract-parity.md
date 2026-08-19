# ADR-0071: A resource's read and write endpoints return one shape, and the published contract must equal what ships

- **Status:** Accepted
- **Date:** 2026-08-19
- **Grilled from:** #805 (escalated by batch triage on the cross-feature criterion, grilled 2026-08-19)
- **Related:** #786 (booking response DTO — documented these gaps and deferred the fix here), ADR-0030 (deterministic checks belong to automation), ADR-0061 (convention + regression-guard over structural seam)

## Context

`GET /bookings/:id` and `PATCH /bookings/:id` return **different shapes**. `findOne` maps the row — collapsing `musicFormConfig`/`musicFormResponse` to boolean `has*` flags, folding `contracts[]` into a normalised `activeContract`, and deriving `portalVisibility` — while `update`, `create` and `updateSeries` return the raw Prisma row with its includes. Two shapes across seven service methods.

Grilling #805 surfaced four findings that shaped the decision:

1. **The divergence is already live, not merely latent.** All twelve bare `PATCH /bookings/:id` call sites are untyped and discard the response body, which is why nothing visibly broke. But `useCreateBooking` declares `apiPost<BookingDetail>` while `create` returns the raw row — a type-level falsehood in the tree today, surviving only because its consumer reads three fields that happen to exist on both shapes.

2. **The mapping is already duplicated.** `findOne` does not call the shared `mapBooking`; it re-implements the identical body inline. Two copies, free to drift, with no check that they agree.

3. **The published contract already under-declares what ships.** `bookingIncludes` uses `customer: true, venue: true, bookingAgent: true`, returning three whole `Contact` rows including `userId`; `PerformanceSet` ships ten columns where the consumer declares six. `BookingResponseDto` documents the *intended* shape and says so in a comment — so the OpenAPI document and the wire disagree by design, and the frontend types carry a caveat explaining the gap rather than a contract.

4. **A second, quieter contract lie runs across the whole API.** `@ApiPropertyOptional({ nullable: true })` on a `string | null` **without** an explicit `type: String` documents the field as `type: object`. This is the same "well-formed, type-checks, silently wrong" family as the dead-Tailwind-class defects (#752 / #803 / #784, guarded by #810): nothing errors, the generated document is simply untrue. A survey found 121 candidate lines across 23 DTO files — an upper bound, since some are legitimately typed via `enum:`.

The common root is that **the contract is asserted in prose and enforced nowhere.** Nothing fails when the mapper and its copy diverge, when Prisma returns more than the DTO declares, or when a decorator documents the wrong type.

## Decision

Two rules, both enforced mechanically rather than by convention.

**1. A resource's read and write endpoints return one identical shape.**

A write returns the same representation a read of the same resource would. Concretely, for bookings: every method returns through the single shared mapper, `findOne`'s inline duplicate is deleted, the mapper carries a real return type instead of `any`, controller methods are typed to the response DTO, and a test asserts that read and write produce identical key sets.

204 No Content was considered and rejected — creation must return the new resource's identity, so writes would diverge from each other again, which is the disease rather than the cure.

**2. The published contract must equal what ships.**

Two corollaries:

- **Queries select what the DTO declares.** The booking detail query narrows from `include` to an explicit `select` across the row, its nested contacts, sets and packages. `userId` in particular is never sent: it is a tenancy id, and publishing it invites a client to branch on it.
- **Nullable scalars are explicitly typed.** `nullable: true` on a scalar carries an explicit `type:`. A guard generates the OpenAPI document and fails when a nullable scalar is documented as `type: object`.

**Pre-existing violations are baselined, not swept.** The guard blocks *new* violations; the 23 files already carrying them are recorded as accepted debt and paid down when next touched. This mirrors `story-presence-baseline.txt` exactly, and follows ADR-0030: an automated gate is worth having on the day it can be turned on, not after a 121-line mechanical sweep it would otherwise have to wait for.

## Consequences

- One booking shape, so mutations can seed the query cache instead of forcing a refetch, and the `apiPost<BookingDetail>` type lie is resolved rather than documented.
- The frontend's `BookingDetail` caveat comment can be deleted: the types become a mirror of the contract again, not an explanation of how it differs.
- Drift is caught by a test rather than by review. The shape test and the OpenAPI guard are the durable record; this ADR is the rationale they cite.
- The nullable guard protects every DTO in the app, not only the one that surfaced the bug.
- **Accepted cost:** the baseline means the generated document stays partly wrong for the 23 grandfathered files until each is touched. Judged better than blocking the guard behind a large mechanical diff.
- **Scope:** these rules are stated generally and apply to any resource, but only bookings and contacts are brought into compliance now. Other modules comply when next touched — the guard makes new violations impossible, not old ones absent.

## Alternatives considered

- **Serialise at the controller boundary** (a NestJS serialisation interceptor, making the DTO the actual shaping mechanism so over-fetched fields can never reach the wire). Structurally the strongest option, and it would have made the query-narrowing rule unnecessary. Declined *for now* because it is a new cross-cutting mechanism affecting every module and deserves its own ADR rather than arriving as a side effect of a booking bug fix. Nothing here forecloses it.
- **Document the divergence honestly** — keep two shapes and add a separate write-response DTO describing the raw row. Cheapest, no behavioural risk, but it enshrines the two shapes permanently and keeps `userId` on the wire.
- **Return only changed fields from a write.** Smallest correct payload; rejected because partial-shape typing is awkward and every consumer would have to handle absence.
- **Fix all 121 nullable lines now, no baseline.** Leaves no debt, but makes the slice much larger than a session and delays the guard behind a sweep touching nearly every feature module.
