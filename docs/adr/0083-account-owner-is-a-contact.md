# ADR-0083 — The account owner is a Contact, kept separate from PublicProfile

## Status
Accepted (2026-09-27). Decided via `/grill-with-docs` on issues #1035/#1036, tracked by #1037.

## Context
[[Band member]] (ADR-0072) established that a band member *is* a Contact — no separate person entity. But a musician filling a vacant [[Chair]] with *themselves* had no route to it: `BookingBandMember.isSelf` existed but nothing ever set it, because no Contact represented the musician. Two identity-shaped models already exist for other purposes — `PublicProfile` (client-facing, always exists) and Clerk (auth) — raising the question of whether a third, band-facing identity was really needed, or whether one of those should be reused or merged into instead.

## Decision
Add `Contact.isAccountOwner` — a boolean, tenant-singleton flag marking which Contact record *is* the musician. It is a real Contact (created once, via the "Add yourself" band-roster flow), so it can carry the same dep-profile fields as any other band member (instruments, travel/equipment/outfit/availability notes, address for proximity ranking) — fields that live only on Contact, not on `PublicProfile` or `UserProfile`.

It is kept **fully separate** from `PublicProfile`: no shared fields, no prefill, no FK. `PublicProfile` is the client-facing identity (always exists, one per tenant, feeds the customer-facing Portal); the account-owner Contact is the band-facing identity (optional — only a musician who plays their own gigs needs one, feeds the future Band portal). ADR-0061 already anticipated `Contact` — not `PublicProfile` — as the future join point for an authenticated dep account (linked by email); this decision keeps that path open rather than cutting across it.

Singleton enforcement is a **partial unique index** (`WHERE "isAccountOwner" = true`), not `@@unique` in schema — Prisma's DSL can't express a filtered constraint, and this codebase already hit the alternative's failure mode once: `Invoice`'s "at most one active invoice per series" was originally a service-level check, later replaced after it proved racy under concurrent writes (see the `Invoice_seriesId_active_key` migration). The service catches the resulting `P2002` and rethrows it as the usual 409.

`Contact.isAccountOwner` (tenant-scoped) is a distinct flag from `BookingBandMember.isSelf` (booking-scoped) — see [[Band member]]. `isSelf` is **derived** from `isAccountOwner` at chair-assignment time, not independently settable by a caller.

## Considered and rejected
- **Match an existing Contact to "me" by email.** Fragile — Clerk's email can differ from or be absent on the Contact's own `email` field, and either can change independently.
- **Stash a self-contact id in `UserProfile.preferences` (JSON).** Avoids a migration, but creates a second, informally-typed pointer to identity — the shape #984 already rejected for lineup↔package.
- **Merge into, or derive from, `PublicProfile`.** Rejected: the two serve different audiences (client-facing vs band-facing) and different cardinalities (always-one vs zero-or-one); merging would force every tenant to carry band-facing fields they may never need, and would contradict ADR-0061's anticipated Contact-based dep-account linkage.
- **Reuse `BookingBandMember.isSelf`'s name for the Contact-level flag.** Rejected — same word, two different scopes, exactly the drift CLAUDE.md's one-declaration-per-vocabulary rule exists to prevent.

## Consequences
- A Contact can now exist purely to represent its own owner — any code that assumes every Contact is "someone the musician does business with" (e.g. reporting, exports, contact counts) should be reviewed if it would otherwise silently include the account-owner Contact.
- The account-owner Contact is deletion-blocked whenever `isAccountOwner` is true, alongside the existing bookings/roster-row guard.
- Future work on a real Band portal identity, or an authenticated dep account, has a settled starting point: `Contact`, joined by email per ADR-0061 — not `PublicProfile`.
