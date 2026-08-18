# ADR-0069: Invoice operations are owner-agnostic; only creation is owner-scoped

## Status
Accepted (2026-08-18). Completes ADR-0063 (one invoice transition home). Builds on ADR-0029 (Invoice belongs to a Booking *or* a BookingSeries) and ADR-0059 (id-keyed, userId-scoped document access).

## Context

ADR-0029 made the Invoice one polymorphic entity — exactly one of `bookingId` / `seriesId` is set. ADR-0063 followed through on the *service* layer: `InvoiceTransitionService` is the single home for every transition, and its side-effects are field-derived rather than branched. The client mirrored it with `invoiceOwnerRoute`, which derives endpoint prefix and cache keys from the owner FK.

The **routes** were never unified. `series.controller.ts` duplicates nine invoice routes (`issue`, `send`, `mark-sent`, `mark-paid`, `void`, `delete`, `preview-number`, `preview.pdf`, `document`), each of which fetches the invoice with `findSeriesInvoiceById` and then delegates to the same service the booking controller delegates to.

More seriously, the duplication was **incomplete**. `PATCH :id` and the three line-item routes (`POST/PATCH/DELETE :id/line-items`) exist **only** under `/bookings/:bookingId/invoices`. There has never been a route by which a series invoice's line items could be edited.

The client half failed in the same place, for the same reason. `BookingDetailSheets.tsx` resolves the invoice a sheet is acting on with `invoices.find((inv) => inv.id === sheetInvoiceId)` over `useBookingInvoices(bookingId)` — a list that by construction can never contain a series invoice, since a series invoice has `bookingId: null`. `InvoiceSheet` therefore received `invoice={undefined}` and silently opened in **create** mode, and `MarkSentDialog` resolved to `undefined` by the same route. The compose sheet's attachment resolution (`composeHelpers.ts`) searches the same booking-scoped list, so it reported "No balance invoice to attach" and hid the template outright.

Net effect, invisible until now: **a series invoice could be created and issued but never edited and never sent from the UI**, and the failure presented as an empty form rather than an error. This falsified two standing claims — that series line items are "pre-populated and fully editable" (CONTEXT.md), and ADR-0043's entire premise that reconciliation must preserve manual edits and custom lines. Nothing could produce a manual edit or a custom line, so the reconciler's `sourceBookingId !== null` guard had been protecting an empty set.

It survived review because `SeriesInvoiceSection.spec.tsx` exercises the **presentational** component with props. Container wiring is outside what it can see.

## Decision

### Shared invoice operations move to an owner-agnostic route family

Operations that act on an **existing** invoice live at `/invoices/:id/...`, scoped by `userId` from the Clerk JWT and by nothing else. The owner is *read off the invoice*, never off the path:

- `GET /invoices/:id`
- `PATCH /invoices/:id`
- `POST /invoices/:id/line-items`, `PATCH /invoices/:id/line-items/:itemId`, `DELETE /invoices/:id/line-items/:itemId`
- ultimately the nine transitions too

**Creation stays owner-scoped** — `POST /bookings/:bookingId/invoices` and `POST /series/:seriesId/invoices`. This is inherent, not an inconsistency: before the invoice exists there is no owner FK to derive from, and the two creation paths genuinely differ (a series invoice auto-generates one line per member booking; a booking invoice does not).

Multi-tenancy is unaffected. Every handler scopes by the JWT `userId` exactly as before; what disappears is the *path segment*, not the tenancy predicate. Repository reads remain `where: { id, userId }`, which satisfies ADR-0061.

### The migration is staged, and the stage is visible

This ADR is written *before* the family is complete. The sweep implements the family for the operations it needs — `GET`, `PATCH` and the three line-item routes — because those are the ones that never existed. The nine duplicated transitions keep working under both owners and are migrated in a **separate, later commit**, after which `invoiceOwnerRoute`'s prefix logic collapses to a constant.

Two route families coexisting is therefore a **known intermediate state with a declared end point**, not drift.

### The client resolves an invoice by id, not by searching a list

`BookingDetailSheets` and every other sheet host resolve the acted-on invoice through `GET /invoices/:id`. Searching an owner-scoped list for an invoice that may not be owner-scoped is the defect class this removes; it is not fixed by unioning the series invoice into the booking's list, because that reintroduces the same assumption one layer down.

## Alternatives considered

- **Mirror the missing routes under `/series/:id/invoices/...`.** Smallest diff, no risk to the working booking flow, and the owner-scoped path structurally proves ownership before the invoice is touched. Rejected: it takes the duplication from nine routes to thirteen and entrenches exactly the split that ADR-0029 and ADR-0063 were written to remove. The repo's standing rule is one declaration per vocabulary; two route families per operation is the same failure in a different medium.
- **Migrate everything at once.** Cleanest end state. Rejected for blast radius — it rewrites the *working* booking invoice flow in the same change that repairs the broken series one, which is a poor trade when the booking flow is the one carrying real money today.
- **Union the series invoice into `useBookingInvoices`.** Would have fixed the three broken sheets with a one-line change. Rejected: it makes "the booking's invoices" mean something it doesn't (a series invoice belongs to no booking), and it leaves the write paths still hard-wired to `/bookings/{id}/...`, so Edit would open correctly and then fail on save.
- **Keep series invoices read-only after creation.** Honest about what shipped, and defensible if line editing were exotic. Rejected: ADR-0043 depends on manual edits and custom lines existing, and a residency invoice needs travel and PA-hire lines at least as much as a single booking does.

## Consequences

- A new controller owns `/invoices/:id`. The existing per-owner controllers keep their creation routes and, for now, their transitions.
- `InvoiceSheet` loses its `bookingId` prop dependency for every write path; it acts on the invoice it was given.
- `invoiceOwnerRoute` survives the intermediate stage unchanged, then reduces to cache-key derivation only.
- Series invoices become editable for the first time, which means ADR-0043's reconciler guard starts protecting a non-empty set. Its behaviour is unchanged; it simply now has something to defend.
- Container-level coverage is required: the existing presentational spec could not have caught this, and its successor must exercise the sheet host with a series invoice, not the section with props.
