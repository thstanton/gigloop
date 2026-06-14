# ADR-0008: Invoice dates and number assigned at send time

## Status
**Superseded by [ADR-0042](0042-invoice-issued-state-decouple-issue-from-send.md)** (2026-06-14).

The reasoning below — that dates and number must not be assigned to a mere draft — still holds. What changed is the *commit point*: they are now assigned when the invoice is **Issued** (finalised), not when it is **Sent** (delivered). ADR-0042 introduces the `Issued` state between `Draft` and `Sent` and moves `issueDate` / `dueDate` / `invoiceNumber` assignment to issue time. Everything below should be read as "at issue time," not "at send time."

---

_Original (now superseded):_

## Context
Invoices are created as drafts before being formally issued. The question was when to assign `issueDate`, `dueDate`, and `invoiceNumber` — at creation time or at the moment the invoice is sent.

The initial implementation set `issueDate` at creation time (defaulting to today). This was wrong: a draft invoice has not yet been issued, so an issue date on a draft is meaningless and misleading. The same reasoning applies to `dueDate` (which is relative to the issue date) and `invoiceNumber` (which consumes a sequence number from a per-year counter).

## Decision
`issueDate`, `dueDate`, and `invoiceNumber` are all nullable on the Invoice model and are assigned only when the invoice transitions to `Sent` — via `POST /invoices/:id/send` (email path) or `POST /invoices/:id/mark-sent` (no-email path).

Defaults at send time:
- `issueDate` — today
- `dueDate` — `issueDate + UserProfile.defaultPaymentTermsDays` (if set), otherwise null
- `invoiceNumber` — next in `UserProfile.invoiceNumberSequence` for the current year

Both the `issueDate` and `dueDate` defaults are overridable by the musician in the send flow.

## Consequences
- Schema migration required: `issueDate` loses its `@default(now())` and becomes nullable; `dueDate` was already nullable; `invoiceNumber` is a new nullable column.
- Draft invoices display "—" for issue date, due date, and invoice number.
- The email render endpoint (`GET /communications/render`) accepts an `issueDate` query param so the template preview shows the correct date before the invoice is formally sent.
- Invoice PDF generation (deferred to a later session) will use the stored `issueDate` from the sent invoice.
