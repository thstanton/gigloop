# ADR-0042: Invoice `Issued` state — decouple issuing from sending

## Status
Accepted (2026-06-14). **Supersedes [ADR-0008](0008-invoice-dates-and-number-assigned-at-send-time.md).** Builds on ADR-0028 (number slot reuse on void), ADR-0006 (template types encode deposit vs balance), ADR-0029 (series as billing grouping).

## Context

The invoice flow conflated two distinct acts. The PDF was generated **only at send time** (`generateAndStoreInvoicePdf` inside `POST /invoices/:id/send`), and `invoiceNumber` / `issueDate` / `dueDate` were assigned at the same moment (ADR-0008). Consequences:

- **No artifact existed before sending.** The musician could not see the real invoice, and there was no draft PDF in Documents.
- **"Create invoice" was misleading.** To the team it meant "create the DB records"; to the musician it implied "produce the invoice document." The document was produced invisibly, later, by the send action.
- **"Mark as sent" was effectively broken.** It assigned a number and set status `Sent` but **never generated a PDF** — so a mark-sent invoice had no `Document` and `InvoiceRow` hid Download. A musician could mark something "sent" that they could never actually have sent, with no artifact to show.
- **No confidence the email went out with its attachment.** The `Communication` record stored the email body but nothing linked the attachment, so there was no "this exact file went to this address on this date" view. (This surfaced during a real send bug.)
- **The series path had drifted worse.** `SeriesService.sendInvoice` calls `generatePreviewPdf` (ephemeral) and **never stores a Document at all** — a sent series invoice left no artifact ever. It is a parallel copy of the booking invoice state machine.

Generating the document only at send was a development convenience, not good UX. Issuing a finalised invoice and delivering it are genuinely separate concerns, and accounting practice already separates *issue* (finalise, assign legal number, lock) from *deliver*.

## Decision

Introduce an **`Issued`** state between `Draft` and `Sent`. The invoice lifecycle becomes:

```
DRAFT ──"Create invoice" (issue)──▶ ISSUED ──Send / Mark-as-sent──▶ SENT ──▶ PAID
  │      number + dates + lock          │      (delivers the stored PDF)
 Delete   + PDF stored as Document     Void
```

### Issue is the commit point (supersedes ADR-0008)

"Create invoice" **issues** the invoice. At issue time the system:
1. assigns `invoiceNumber` (incrementing `UserProfile.invoiceNumberSequence`, or inheriting a freed number per ADR-0028),
2. sets `issueDate` (default today) and `dueDate` (default `issueDate + defaultPaymentTermsDays`),
3. **locks the line items**,
4. **generates the PDF and stores it as an `INVOICE` [[Document]]** (R2 + `Document` record).

`invoiceNumber` / `issueDate` / `dueDate` are no longer assigned at send. The existing `assignInvoiceNumberOnly` logic moves from the send path to the issue path; its number-allocation behaviour is unchanged.

### The invoice number is previewed before issue

To reinforce confidence, the invoice number that *will* be assigned is shown **before** committing:

- In the **new-invoice sheet**, near the commit buttons, reacting to the deposit/balance toggle (re-use is per booking + type): fresh → *"When issued, this will be invoice **INV-2026-007**."*; re-use → *"Invoice number **INV-2026-005** (from the voided invoice) will be re-used."*
- In the **issue confirmation dialog**, folded into the commit copy: *"Create and lock this invoice? It'll be issued as **INV-2026-007** and can't be edited afterwards."* (re-use variant accordingly). This is the authoritative-at-commit restatement, firing immediately before allocation.

The preview is **advisory, not a reservation.** It is a read-only **dry-run of the existing `allocate()`** (allocates nothing, reuses the real logic so preview === reality), exposed for booking *and* series invoices and parameterised by `isDeposit`, returning `{ invoiceNumber, willReuse }`. The fresh-sequence prediction could in principle drift if another invoice is issued in between, but this is a single-user app with sequential actions, so in practice it is stable; the re-use case is deterministic. We deliberately do **not** pre-reserve the number when the sheet opens — that would burn numbers on abandoned sheets (and widen the gap problem). The issued invoice remains authoritative.

### `Draft` vs `Issued` commitment semantics

- **Draft** — freely editable scratchpad; no number, no dates, no PDF. **Does not satisfy the `invoiceExists` checklist rule** (see below). Deletable.
- **Issued** — committed and immutable. **Editing = void + recreate** (ADR-0028 reuses the number slot for the same booking + type, so no sequence is burned on the common edit case). There is no "revert to draft" / un-issue. An issued-but-never-sent mistake is **voided, not deleted** — the rule is uniform: *un-numbered drafts are deleted; any numbered invoice is voided.*
- The musician is **warned that issuing is a committing action** before it happens (dialog on "Create invoice"; an equivalent notice inside the send composer for "Create & send"). Saving a draft carries no warning.

### Send delivers the stored PDF — never regenerates

`Send` attaches the **exact stored Issued `Document`** and emails it, then marks `Sent`. It does not regenerate the PDF. This guarantees *what was previewed = what is in Documents = what the customer received*, and removes drift risk if profile/logo/data change between issue and send. `Mark as sent` marks `Sent` without emailing (no number assignment — already done at issue). Both operate on an `ISSUED` invoice.

### Send is auditable (attachment ↔ communication)

When an invoice is sent, the attachment `Document` is **linked to the `Communication` record**, and the send is surfaced on the invoice/comms log as a plain confirmation — e.g. *"Sent to jane@example.com on 14 Jun · [invoice PDF]"*. This turns "I clicked send and hoped" into a verifiable record.

### Actions by state (UX)

- **New-invoice sheet:** **Save draft** (→ Draft), **Create invoice** (→ Issued), **Create & send** (→ Issued, then opens the send composer pre-filled with the cover template; on confirm emails the stored PDF and marks Sent).
- **Draft row:** Create invoice, Create & send, **Preview** (ephemeral, watermarked "DRAFT — no number assigned"), Edit, Delete.
- **Issued row:** Send, Mark as sent, Download, Void.
- **Sent row:** Mark as paid, Download, Void (+ send-audit line).
- **Paid row:** Download, Void.

The verb **"Send" only ever appears on an already-Issued invoice**. On a draft the equivalent is **"Create & send"** (issue, then deliver) — honest about the fact that it creates the real document and then sends it. Both route through the same send composer, so the composed email and attached PDF are always visible before anything leaves.

### Checklist auto-complete fires on issue

The `invoiceExists` rule (`create_deposit_invoice` / `create_balance_invoice`) currently matches any non-VOID invoice — **including a draft**. It is tightened to fire only on a real invoice: `status NOT IN (VOID, DRAFT)`. Saving a draft no longer ticks the checklist; issuing does.

### One shared lifecycle for booking and series invoices

The booking-scoped (`InvoicesService`) and series-scoped (`SeriesService`) invoice state machines are **unified** into one shared path for everything downstream of "an invoice exists" — issue, send (storing the Document), mark-sent, void, mark-paid, number allocation. The only genuinely different parts stay separate: **creation** (line-item pre-population — customer/fee vs one line per member booking) and **ownership** (`bookingId` vs `seriesId`). This kills the demonstrated drift (series never storing a PDF). Series invoices are fully in scope and get the same `Issued` state.

### Naming

The committed state is **`Issued`** (pill set: Draft · Issued · Sent · Paid · Void). The button stays **"Create invoice"** (the musician's language); the resulting state reads as "Issued" (unambiguous — a draft is also "created", so "Created" is rejected as a state name). `Issued` gets its own pill colour, distinct from Draft (muted) and Sent (blue).

## Alternatives considered

- **Proforma (numberless) pre-send PDF.** Generate a watermarked document at "Create invoice" but still assign the number at send. Rejected: the artifact in Documents would not be the real invoice; a manually-sent copy would have no number, and send would produce a *second* PDF. Confusing, and defeats the "the document you see is the real one" goal.
- **Keep issue and send fused, just surface a draft preview.** A smaller change, but it leaves "Mark as sent" broken, leaves no durable pre-send artifact, and doesn't address the confidence/audit gap.
- **Combined one-click "Create & send" only, no separate issue.** Rejected as the *only* path — it re-blurs the line this ADR draws. "Create & send" is offered *alongside* the explicit two-step, and still routes through the composer so the artifact is visible before delivery.
- **Fix booking and series paths in place (no unification).** Rejected: the two copies already drifted into a bug; maintaining the issue/send/audit logic twice guarantees they drift again.

## Consequences

- **Schema:** add `ISSUED` to the invoice status enum (Prisma migration — requires confirmation before running). Add a link between `Communication` and the attachment `Document` for the send-audit surface.
- **DTOs:** `issueDate` / `dueDate` move off `SendInvoiceDto` / `MarkSentDto` (set at issue, not send). The invoice-level `PATCH update` must be **guarded to `DRAFT`-only** (it currently does not check status — an issued invoice's fields could be patched).
- **Number gaps are possible and acceptable.** Because "edit = void + recreate" is now a routine, encouraged workflow, numbers are burned and reclaimed more often. Void → recreate on the **same booking + type** cleanly reinherits the freed number (ADR-0028). But **issue-then-abandon-entirely** bumps the global sequence and never decrements it, leaving a gap. This is acceptable for a UK/VAT context provided voided invoices are retained and traceable — the sequence is *append-only*, not *gapless*.
- **Frozen branding is intended.** Send reuses the issue-time PDF, so an issued invoice keeps its issue-time logo/`brandColour` even if the profile changes later. This is intended immutability, not a bug.
- **"Create & send" is not atomic.** Backing out of the composer after issue leaves a valid `ISSUED`-not-yet-`SENT` invoice. That is a legitimate state — the UX must not treat it as an error or a lost invoice.
- **Void retains the Document** for audit. `generateAndStoreInvoicePdf` replaces the document keyed per `invoiceId`, so void + recreate (a new `invoiceId`) does not clobber the voided invoice's stored PDF.
- **Draft preview** renders via the existing ephemeral `generatePreviewPdf`, watermarked and explicitly marked "no number assigned" so it cannot be mistaken for the issued artifact.
- **Lifecycle unification is its own slice.** Per CLAUDE.md ("refactoring is its own deliberate work"), when this is sliced into issues the booking/series lifecycle unification is a **dedicated first slice/commit**, sequenced before the behavioural slices that build on the unified path — not smeared across feature commits.
- Series membership-sync and block-when-issued are covered separately in **ADR-0043**.
