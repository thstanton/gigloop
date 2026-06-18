# ADR-0047 — Atomic booking creation (service-owned cross-module transaction)

## Status

Accepted (2026-06-18). Fixes the duplicate-booking UAT bug (grilling backlog #472, thread 2).
Implementation is downstream work.

## Context

A UAT round produced **duplicate bookings**: the first submit reported failure, the user retried, the
retry succeeded, and **two identical bookings** existed — the first write had committed but was
reported to the client as a failure.

Two mechanisms can produce this exact symptom (500 to the client while the booking actually exists):

- **Path A — non-atomic create.** `BookingsService.create` commits the booking row via `repo.create`
  (or `createWithFormats`), **then** seeds checklist items and appends the series invoice line as
  **separate, un-grouped writes**. A throw in any later step propagates to the controller as a 500,
  but the booking row is already committed. The user retries → a second booking. The non-atomicity is
  the **root enabler**: it converts a transient blip into a persisted duplicate.
- **Path B — lost acknowledgement.** The entire request (booking + checklist + sync) succeeds
  server-side, but the response is lost in transit (gateway timeout / Neon cold-start after commit).
  The client sees failure → retries → duplicate. The write succeeded; only the ack was lost.

**Working diagnosis: Path A.** It is structurally certain (read directly from the code) and
parsimonious about the 500 — Nest returning 500 because a later step threw is a clean, code-level
explanation, whereas Path B needs a second actor (a gateway) to manufacture a 5xx after the handler
already succeeded. The two paths share a *trigger* — a transient connection blip (and #371's own "Neon
pooler fix" confirms those were real here); they differ only in **where** it lands: mid-write → A, on
the ack after commit → B. The rogue UAT booking was deleted, so no data fingerprint remains to settle
it, and a cold-start could plausibly favour B (slow first statement → infra timeout → commit-then-
lost-ack).

The decision is **robust to that ambiguity**, and that is the spine of this ADR: **fix the certain
structural defect regardless of which mechanism fired.** The non-atomic create is a clear bug on its
own terms; closing it is correct whether the trigger lands at A or B. If duplicates **recur** after
this fix, that is the signal Path B is live — and the deferred idempotency key (below) is the
response. A recurrence therefore *validates* this ADR's staging rather than refuting its diagnosis.

## Decision

- **Booking creation is atomic.** Wrap the booking row + checklist seed + series-invoice-line append
  in a **single Prisma interactive transaction**. A failure anywhere rolls back to zero — no orphan
  booking — so a retry creates exactly one booking. This closes Path A with no residual
  retry-triggering failure mode (every step that can throw a 500 is inside the atomic unit).

- **The series sync lives inside the atomic unit**, not best-effort. It is a single *conditional*
  line-append to a draft series invoice (and only on the series path); the weaker best-effort
  guarantee — and the "reconcile later" concept it drags in — earns nothing for one local row.

- **The service owns the transaction (Option A).** `BookingsService.create` opens
  `prisma.$transaction(async (tx) => …)` and threads `tx` into each repo method (`create` /
  `createWithFormats`, `seedChecklistItems`, `findDraftSeriesInvoiceWithLines`,
  `appendSeriesInvoiceLine`). This is the **first cross-module transaction** in the codebase — it
  spans the bookings, checklist, and series modules, so it cannot live inside a single repository. We
  read a **transaction boundary as orchestration** (legitimately the service's job) rather than a data
  query: the actual reads/writes still run in the repositories via `tx`, so the repository-pattern
  rule (CLAUDE.md → Repository Pattern) holds in spirit. `PrismaService` is injected into the service
  **solely** to open the transaction — a deliberate, bounded exception recorded here.

- **No client changes.** Once create is atomic, the existing behaviour — the button re-enables on
  error and shows "please try again" — is **acceptable**: under Path A a failed create persists
  nothing, so the retry yields exactly one booking. (It is *fully* correct only if Path B never fires;
  given Path B is deferred, the retry-on-error UX is acceptably-risky, not provably safe — the
  recurrence path covers the residual.) No client change is warranted now.

- **The idempotency key is deferred** (not rejected). Path B (lost-ack) is a generic property of any
  networked write and is never fully eliminable, but it is **unconfirmed** here. We do **not** build
  idempotency infrastructure now. If duplicates recur after this fix, the prime candidate is a
  **client-minted booking UUID**: the PK is already `@default(uuid())` and unique, so a retry replays
  the same id, the unique constraint throws `P2002`, and the server returns the existing row — an
  idempotency guarantee with **no new table, column, or migration**.

## Consequences

- Path A is closed completely.
- Repo method signatures gain an optional `tx?: Prisma.TransactionClient`; when omitted they fall back
  to `this.prisma`, so non-transactional callers are unaffected.
- The service touches the Prisma API for the first time, but only `$transaction` — documented above as
  a bounded exception, not a general loosening of the repository pattern.
- A future cross-module transaction (apply-package, invoice flows) can copy this pattern. If the bend
  recurs often enough to want a seam, extract a thin `TransactionHost` then (the deferred Option C).
- Series-invoice-line drift on a sync failure is no longer possible at create time — it rolls back
  with the booking.
- `createWithFormats` already does its writes as a **nested** `booking.create` (`sets` / `packages` /
  music-form config), not an inner `$transaction`, so threading `tx` is clean (`tx.booking.create`)
  with no nested-transaction conflict.
- **Transaction timeout must be tuned for cold-starts — an open implementation question, not a settled
  one.** `directUrl` only fixes the *connection mode* (a pooled PgBouncer session cannot hold an
  interactive transaction); it does **nothing** for the *transaction timeout*. Prisma interactive
  transactions default to `maxWait: 2s` / `timeout: 5s`, and a Neon scale-to-zero cold-start landing
  at the **start** of the transaction counts against those defaults — which is precisely the scenario
  that motivated this work. Net effect is still an improvement (a clean rollback + retry beats a
  duplicate), but without tuning we risk converting "slow success" into "failure." The invoices
  precedent does **not** transfer — those run on an already-warm connection. The implementation must
  decide explicit `{ maxWait, timeout }` values (or a warm-up ping) and make this an acceptance
  criterion.
- **Tests:** a service-level test asserting that a forced throw in a later step (checklist seed or
  series append) leaves **no booking row** — the regression guard for Path A.

## Alternatives considered

- **Client hardening only** (fetch timeout + keep the button disabled). Rejected as a *fix*: it
  provably cannot prevent a duplicate when the server commits but the ack is lost, and does nothing
  for Path A. Also rendered unnecessary by the atomic fix.
- **Natural-key dedup** (same `userId` + `customerId` + date within N seconds → return the existing
  booking). Rejected: it would silently collapse two **legitimate** same-customer-same-day bookings
  (e.g. an afternoon ceremony and an evening party) into one — a data-loss-shaped bug.
- **Idempotency key / client-minted PK now.** Deferred, not rejected — the correct defence for Path B,
  but Path B is unconfirmed and the key is premature. Recorded above as the recurrence path.
- **Best-effort series sync** (atomic core + swallowed sync error, à la `evaluator.evaluate(…).catch`).
  Rejected: best-effort earns its keep for heavy/external side-effects (email, PDF), not one local row.
- **Transaction owned by a bookings-repo orchestrator (Option B).** Rejected — forces one repository
  to write other modules' tables, breaking module boundaries.
- **`TransactionHost` / Unit-of-Work abstraction (Option C).** Deferred — keeps the rule's letter
  intact but is new infrastructure for a single call site today; revisit when a second cross-module
  transaction appears.
