# ADR-0063 — One persistence home and one transition home for the Invoice entity

**Status:** Accepted

## Context

ADR-0029 established that `Invoice` is a **single entity with polymorphic ownership** — it
belongs to *either* a `Booking` (`bookingId` set, `seriesId` null) *or* a `BookingSeries`
(`seriesId` set, `bookingId` null), exactly one FK set. The *schema* honours this. The *code*
did not: the one entity's lifecycle and persistence were re-implemented across two modules.

- **Two owner services re-derive the same transition orchestration.** `invoices.service.ts`
  (booking) and `series.service.ts` (series) each re-implement issue / send / mark-paid / void,
  including a byte-identical issue-date + payment-terms block.
- **The entity's data-access is smeared across two repositories, and not cleanly.**
  `invoices.repository.ts` holds booking-scoped Invoice queries *plus* three series ones
  (`assignSeriesAndMarkIssued`, `assignSeriesInvoiceNumberOnly`, `previewSeriesInvoiceNumber`);
  `series.repository.ts` *also* hits `prisma.invoice` directly for ~8 more. "Where does an
  Invoice get read/written?" had no single answer.
- **The duplication had already bred drift.** Three orphaned, divergent second-implementations
  existed with zero production callers: `invoices.repository.markPaid`,
  `series.repository.markSeriesInvoicePaid`, `series.repository.findVoidedSeriesInvoiceWithNumber`.
  A `markPaid` copy set `depositReceivedAt` inside its transaction; the live path sets it
  separately — a landmine for whoever wired up the orphan thinking it was canonical.

A partial fix already existed — `InvoiceLifecycleService`, which both owners route transitions
through via injected callbacks. It got ~80% of the *transition recipe* into one place but left
the entity's *persistence* split and the last shared calc copy-pasted.

The obvious-looking alternative — **merge the two modules** — was rejected. The `series` module
owns a distinct aggregate (membership, member-booking sync, line reconciliation); invoicing is
only one of its concerns. Merging would jam two aggregates into one module. The right unit to
consolidate is the **Invoice entity**, not the modules.

## Decision

The `Invoice` entity gets **one persistence home** and **one transition home**; the modules stay
separate.

1. **One transition home.** `InvoiceLifecycleService` (renamed `InvoiceTransitionService`) owns
   the whole transition — rule check, status write, PDF, *and* the issue-date/payment-terms calc
   that was duplicated. It covers issue / send / mark-paid / void. It does **not** own `create`
   (booking-create and series-create genuinely differ — series-create builds line items by
   reconciling member bookings) or the create-time "one active invoice" guard.

2. **Side-effects are field-derived, nothing is injected.** The transition service reads the
   invoice's own `bookingId` / `seriesId` / `isDeposit` to decide every side-effect — deposit
   stamp (`isDeposit && bookingId`), void checklist-reset (`bookingId` + `isDeposit` picks the
   key), affected-booking re-evaluation (the booking(s) the invoice touches), *and* number
   allocation (branch on `seriesId`). For a series invoice every booking-shaped side-effect
   no-ops **by construction**, because the fields are null. The owner services collapse to their
   thinnest form: fetch the owner-scoped invoice, hand it to the transition service, return — with
   zero owner-specific callbacks.

3. **One persistence home.** All Invoice *lifecycle* CRUD (find / create / void / mark-paid /
   assign-number, for both owners) lives in `invoices.repository.ts`. `series.repository.ts` stops
   touching `prisma.invoice` for lifecycle CRUD and delegates (via `invoicesRepo`, which
   `series.service` already injects). **Boundary:** genuinely *series-aggregate* operations —
   building an invoice from member bookings, reconciling lines on join/leave
   (`findMemberBookingsForInvoice`, `findDraftSeriesInvoiceWithLines`,
   `append`/`removeSeriesInvoiceLine`) — **stay** in `series.repository.ts`. They are
   series-membership logic that happens to write invoice lines, not Invoice CRUD.

4. **The three orphaned methods are deleted.**

This is **behaviour-preserving** — the only observable change is *where* code lives. But the
existing suites are *not* a sufficient net for it: the void-reset and deposit-set logic is today
tested only indirectly through the owner services, and the fact that three dead methods survived
with live mock-stubs is direct evidence of coverage gaps. So the refactor **must add unit tests on
`InvoiceTransitionService`** pinning the field-derived branches — at minimum: (a) voiding a *series*
invoice triggers **no** checklist reset and **no** re-evaluation; (b) voiding a *deposit* booking
invoice with `remaining === 0` resets `create_deposit_invoice`; (c) mark-paid on a deposit booking
invoice stamps `depositReceivedAt`, and on a series invoice does not. That converts "series does
nothing, by construction" from a claim into a regression-locked fact.

## Consequences

- "Series void touches no checklist" stops being an unexplained asymmetry between two callers and
  becomes a property that falls out of field-derivation in one place — self-evidently correct,
  readable at a glance. Defect 2 in the original #684 dissolves: there was no forgotten mirror
  call, only two owners of one entity that genuinely differ in their fields.
- **Explicitly out of scope, deferred to its own issue:** a series *member* booking is seeded the
  standard checklist, including `get_deposit_paid` / `get_balance_paid` goals whose `invoiceExists`
  steps can **never** auto-complete (a member booking can't hold a booking-level invoice, and the
  checklist evaluator has no series-awareness). This is a checklist-*modelling* gap, not a
  transition-duplication one; the provisional direction is to **SKIP** those goals for series
  members. This ADR deliberately changes **zero** checklist behaviour.
- `invoices.repository.ts` grows past the ~300-line yellow flag as series CRUD moves in (net less
  code than today — three methods are deleted). Worth a `/simplify` pass at PR.

## Client mirror (#687 and its siblings)

The same one-entity truth was re-examined on the web side and found to be violated there too — in
three ways that mirror the API's. Grilled 2026-07-18; the client work is sequenced *after* this
API-side consolidation.

- **The client fabricated a second entity.** `apps/web/src/types/api.ts` declared *two* interfaces —
  `Invoice` (only `bookingId` + `isDeposit`) and `SeriesInvoice` (only `seriesId`, no `isDeposit`) —
  each dropping the other's fields. But the API returns the **raw Prisma `Invoice` row** from both
  endpoint families (no response DTO — see below), so the wire shape is *already one shape* with both
  FKs nullable and `isDeposit` always present. The split was pure client fiction, and it was the root
  cause of five `as unknown as Invoice` casts (a cast between two things that are actually one thing).
  **#687** deletes `SeriesInvoice`: one `Invoice` type with `bookingId: string | null` /
  `seriesId: string | null`, "series vs booking" derived from which FK is set. The casts vanish
  because there is no second type to bridge.
- **A modelling bug fell out of the fiction.** `InvoiceRow` read `invoice.isDeposit` on a cast series
  invoice, where it is `undefined` → falsy → the row silently rendered a series invoice as **"Balance"**.
  CONTEXT already specifies the label should be **"Series invoice"** (Invoice → "Invoice section in
  booking UI"); the code just never matched the doc. #687 makes it match — the *one* intentional
  behaviour change in an otherwise behaviour-preserving refactor — via a pure `invoiceLabel(invoice)`
  derivation (`seriesId ⇒ 'Series invoice'`, else `isDeposit ? 'Deposit' : 'Balance'`).
- **The transition recipe is duplicated across two owners — again.** `useInvoiceActions(bookingId)`
  (booking, a hook) and `SeriesInvoiceCard` (series, six *inline* `useMutation`s) re-implement the same
  issue / send / mark-sent / mark-paid / void / delete recipe, differing only in URL prefix
  (`/bookings/:id` vs `/series/:id`) and invalidation keys. This is the client twin of the "two owner
  services" finding above. Collapsing it into one **field-derived** `useInvoiceActions(invoice)` that
  branches on the invoice's own `bookingId`/`seriesId` is the client mirror of this ADR's
  one-transition-home — deferred to its **own sibling issue** (it depends on #687's unified type and
  is a substantial merge in its own right), keeping #687 bounded to type-unification + a pure
  `invoiceDerivations` module + collapsing `InvoiceRow`'s 14-param interface to a handlers object.
- **The response-DTO gap that *enabled* the fiction.** The `invoices` and `series` modules return raw
  Prisma entities and carry only prose `@ApiResponse` descriptions — no `InvoiceResponseDto`, in
  violation of the repo's `@ApiProperty`/typed-`@ApiResponse` rule (other modules — documents,
  contacts, bookings — do have response DTOs). With no wire contract, nothing contradicted the two
  half-types. Fixing it (a real `InvoiceResponseDto` with nullable `bookingId`/`seriesId` +
  `isDeposit`-always) is a distinct API concern, split to its **own sibling issue** rather than folded
  into this ADR's tight persistence/transition scope.
