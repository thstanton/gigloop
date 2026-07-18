# ADR-0061: Tenant scoping stays convention + regression-guard, not a structural seam

- **Status:** Accepted
- **Date:** 2026-07-18
- **Supersedes the proposal in:** #683 (grilled 2026-07-18)
- **Related:** ADR-0025 (no long-lived/sibling branches), #681 (mail recipient), security review 2026-07-07 (B1 / H2 / M1)

## Context

Multi-tenancy is a Hard Rule ("no endpoint may return cross-tenant data"), enforced by convention: `AuthGuard` stamps `request.userId`, and every read is scoped `where: { id, userId }` by hand across 16 `*.repository.ts` files. Mutations, however, take a bare `id` — safety depends on the service having first done a `userId`-scoped read. #683 (surfaced by `/improve-codebase-architecture`) proposed closing this structurally with a single tenant-scoping **seam**: a Prisma `$extends` client extension or a typed base-repository that injects `userId` into every query, making cross-tenant access impossible by construction.

Grilling the proposal surfaced three findings that change the calculus:

1. **The write-gap is latent, not live.** Every current bare-id mutation *is* preceded by a `userId`-scoped read (verified: `invoices.service.update/delete` call `findOne(userId, …)` first; every sibling follows the pattern). As the API is written today, a cross-tenant *write* is not reachable. The seam guards only against a *future* dropped read.

2. **The genuinely live hole is elsewhere — and the seam does not close it.** Inbound FK references (`customerId`/`venueId`/`bookingAgentId` on bookings, `billToContactId` on invoices, `bookingId`/`contactId` on `sendEmail`) are not ownership-validated. A user can attach a *foreign* contact to their own booking and read it back — a live cross-tenant *read* (H2/M1). A `userId`-injection seam scopes *the row written, not the foreign keys it references*, so it leaves this hole open.

3. **The tenant model is about to change.** Band-member accounts (north-star Wave 2) introduce **shared ownership** — a booking owned by the leader but readable by members. A rigid `userId ==` predicate baked into ~40 methods across 16 repositories would have to be torn back out and rewritten to "…or I am a member of this booking's band." Committing to strict userId-equality everywhere now is premature and paints us into a corner.

The mechanism analysis also weighed against the seam independently: `$extends` needs an **ambient** userId, but the `@Cron('0 7 * * 1')` digest job runs with **no request** and issues a deliberately **all-tenant** query (`findUsersWithDigestEnabled`) — so an always-on injection needs escape hatches at exactly the un-tenanted paths (cron, portal-by-token). Request-scoped Prisma would also cascade through the whole DI chain and break the singleton `PrismaService.onModuleInit` cold-start retry (#612). A typed base-repository avoids the ambient-userId machinery but still costs ~40 hand edits.

## Decision

**Do not build the structural tenant-scoping seam now.** Instead:

1. **Close the live hole directly.** Add FK-ownership validation (`assertContactsOwned(userId, ids[])` — one batched query; all four contact FKs reference the `Contact` table) on the booking/invoice write paths, plus the missing `findBookingById` guard and `contactId` check on `communications.sendEmail`. Foreign id → 404. *(Its own issue, ships first.)*

2. **Guard the latent gap cheaply.** Extend `scripts/shortcut-detector.mjs` (already in the pre-commit hook) to flag *new* bare-id mutations (`.update/.delete/.upsert` with `id` but no `userId` in the `where`) in `*.repository.ts`, with a `// scoped-upstream:` suppress comment for legitimate cases. Because the detector scans only the staged diff, the ~40 existing methods are grandfathered automatically. Add one cross-tenant integration test as the runtime backstop. *(Its own issue.)*

3. **Park the seam.** Revisit *after* the band-member ownership model is designed — at which point the correct scoping predicate is known and the seam (if still wanted) can encode it once, rather than encoding a soon-to-be-wrong predicate now.

## Consequences

- The live confidentiality hole (H2/M1) is closed immediately and cheaply, decoupled from the large refactor.
- Future cross-tenant write regressions are caught at commit time (static) and CI (integration test), without rewriting 40 methods.
- Tenant safety remains partly conventional for existing mutations. Accepted: they are all currently correct, the app is solo/pre-launch, and the guard prevents new violations.
- We retain freedom to design the seam around the *real* (shared-ownership) tenant model later, instead of building it twice.
- **Reversibility:** the base-repository seam remains available as a future move; nothing here forecloses it. This ADR records *why it was declined now* so a future reader finding #683 understands the deferral.

## Alternatives considered

- **`$extends` client extension (ambient userId).** Rejected: needs request-scoped Prisma (cascades through DI, breaks the #612 cold-start retry) or AsyncLocalStorage/CLS; and the cron/portal paths structurally cannot supply an ambient userId, forcing escape hatches at the dangerous paths.
- **Typed base-repository (explicit userId), full 16-repo migration.** The strongest structural guarantee and the mechanism we would pick *if* we built a seam — but ~40 hand edits committing to a userId-equality model that band-member accounts will invalidate. Deferred, not rejected.
- **Do nothing beyond FK-ownership.** Rejected: leaves no guard against the future dropped-read regression; the shortcut-detector rule is nearly free.
