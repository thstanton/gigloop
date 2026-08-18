# ADR-0068 — The Invoice is the sole record of money; `paidAt` is the date received

**Status:** Accepted

## Context

GigLoop had no record that money arrived on a given date. It had a record that a *button was
pressed*.

- **`Invoice.paidAt` was the tap moment.** `invoices.repository.ts` `markPaidBase` writes
  `paidAt: new Date()`, and mark-paid is a one-tap, empty-body POST from three surfaces (the
  invoice row action, the series invoice card, and the #653 checklist CTA). Nothing in that path
  accepts a date. A musician catching up on a fortnight of admin stamps today onto payments that
  landed a fortnight ago — and unlike most defects this one cannot be repaired later from memory.
- **`Booking.depositReceivedAt` was a second, worse copy.** It predates `paidAt` and survived the
  removal of `depositTrackingMode` when deposit tracking moved to the checklist. Same defect (three
  write paths, all `new Date()`), no UI at all, and `CONTEXT.md` asserted both that it "records when
  the deposit actually arrived" *and* that "the timestamp is always now" — the bug written down as
  the design. It also gave the deposit a non-invoice payment path that the balance deliberately
  never had, an asymmetry with no domain justification: it existed because the column existed.

This became urgent ahead of the rest of Wave 2's Pillar 2 (`docs/north-star.md`) because the cash
lens and accountant export are built on this data, and every day of live use writes more dates that
cannot be reconstructed.

## Decision

**The Invoice is the sole record of money received.** No other entity records that money arrived.

**`paidAt` means the date the payment was received** — chosen by the musician, defaulting to today,
captured in a dialog when they mark the invoice Paid, and correctable afterwards by re-opening that
same dialog. An optional payment **reference** is captured alongside it. `Invoice.status` keeps
`PAID` as a stored member; nothing about the status vocabulary changes.

**`Booking.depositReceivedAt` is retired** (expand/contract, per CLAUDE.md), and `deposit_received`
becomes symmetric with `balance_received` — both read the invoice.

The user-facing rule is one sentence: *money is recorded on an invoice.* Its consequence is
deliberate — a payment taken without an invoice is not money as far as GigLoop is concerned.
Marking a *received* step complete without an invoice still completes the workflow but records
nothing, so it never reaches reporting. Previously only deposits had an escape from this, by
accident of history.

## Considered options

- **Make `paidAt` settable *and* give `depositReceivedAt` a UI.** Rejected on user-facing grounds
  first: two separately-editable dates that both mean "when the deposit arrived" cannot be
  explained to a musician.
- **Model `Payment` as a first-class entity** — an event with its own amount, date and reference,
  with invoice settlement (`Unpaid | Part paid | Paid`) derived from the sum. This was explored in
  detail and **deliberately deferred**. It is the better model in the abstract: an invoice is a
  document, a payment is an event, and only a payment carrying its own amount can represent a short
  payment, an instalment or an overpayment. It was rejected for now because **those cases are
  outside what this app is for** — GigLoop already expresses splitting as a deposit invoice plus a
  balance invoice — and because the urgent, asked-for problem is knowing *when* an invoice was
  paid. Re-plumbing a live money path, migrating every `PAID` row, and rewriting every
  `status = 'PAID'` query is a large, unrequested change to buy capability nobody has needed. It
  may well be revisited; this section exists so it need not be re-derived from scratch.
- **Model refunds.** Out of scope with the entity. A refunded deposit continues to count as
  earnings.

## Consequences

- **An invoice is paid in full or not at all.** The amount received is always taken to be the
  invoice total. This is an accepted limitation, not an oversight — see the deferred entity above.
- **Deposits recorded via the non-invoice path lose their date** when the column is dropped; there
  is no invoice to migrate them onto. Their checklist steps stay complete (steps are sticky —
  `checklist-evaluator.service.ts:74`), so nobody is re-nagged; only the money fact is discarded.
  Count the affected rows before dropping.
- **Existing `paidAt` values stay approximate.** They are tap-dates. The fix stops the bleed rather
  than repairing history; the correction affordance is how a musician fixes the ones that matter.
- **Mark-paid stops being a one-tap action.** It opens a dialog capturing date and reference. This
  is also the only way to discharge the North Star's requirement that the UI make clear marking an
  invoice paid *drives the financial reporting* rather than merely dismissing a reminder.
- **Recording a payment against an `ISSUED`-but-unsent invoice** is currently impossible —
  `isPayable` gates on `SENT` (`invoice-transition-rules.ts:26`). An invoice handed over in person
  and paid must be marked sent first. Whether to relax this to any non-`DRAFT`, non-`VOID` invoice
  is left to the feature's issues.
- **`prisma/seed.ts` writes `status: 'PAID'` with no `paidAt`** at four sites, so seeded preprod
  data has null payment dates. Any backfill or reporting query must tolerate it.
