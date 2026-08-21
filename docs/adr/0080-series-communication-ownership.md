# ADR-0080: Communication gets polymorphic ownership; read surface is the existing booking Communications list

- **Status:** Accepted
- **Date:** 2026-08-21
- **Closes:** #927 (grilled 2026-08-21)
- **Related:** ADR-0029 (polymorphic Invoice ownership), ADR-0063 (invoice transition service, #684), ADR-0078 (series member bookings skip money goals), #830 (series Document unreachable — the precedent this deliberately does NOT repeat)

## Context

Sending a series invoice emails the client and transitions the invoice to `SENT`, but `communications.service.ts#sendEmail` takes an early exit whenever `bookingId` is absent — no `Communication` row is ever written for a series send. This was deliberate (left out of #847), blocked on two questions: `Communication.bookingId` is non-nullable, and even if it were relaxed, there was no UI surface where a series-scoped communication could be read — the same "artifact exists, route to it doesn't" defect #830 hit for series Documents.

#830's fix added a new seriesId-scoped API route plus a dedicated `SeriesInvoiceCard` embedded in the member booking's detail page, rather than merging into any existing booking-scoped list. That option was offered for Communications and declined in favor of the existing booking-scoped list.

## Decision

**`Communication` gets the same polymorphic ownership as `Invoice`:** `bookingId` becomes nullable, a new nullable `seriesId` is added (→ `BookingSeries`, `onDelete: Cascade`, mirroring `Invoice.seriesId`). Exactly one of the two is set, enforced at the application layer only (construction-time guarantee via two separate creation paths) — no DB `CHECK` constraint, matching `Invoice`'s existing precedent (ADR-0029) rather than diverging from it.

**Read surface: the existing booking-scoped Communications list, not a new surface.** `CommunicationsRepository.findAll(userId, bookingId)` loads the booking, then returns rows where `bookingId` matches OR (`booking.seriesId` is not null AND the row's `seriesId` matches it) — a single merged, `createdAt`-sorted list, scoped by `userId` across the whole query. A series communication is therefore visible identically on every member booking's page — the same duplication #830 already accepted for `SeriesInvoiceCard`. That duplication was accepted deliberately: on a series member booking there is unlikely to be any competing booking-level communication history for the series row to be confused with. The frontend gets a "Series" badge on rows where `seriesId` is set; no new component, no new page.

**Two correctness traps this creates, both must be closed in the same change:**
- The `OR seriesId` leg must be omitted entirely when `booking.seriesId` is null — otherwise the query becomes "every communication with a null seriesId," i.e. that user's entire communication history, on every non-series booking's page.
- `userId` must scope the whole `OR`, not one leg — `where: { userId, OR: [...] }`, never `where: { OR: [{ userId, bookingId }, { seriesId }] }`, which would leak cross-tenant on the second leg.

**No `ChecklistReevaluator` hook for series sends.** Consistent with ADR-0078: series bookings have no series-scoped checklist concept, so there is nothing to re-evaluate.

**Cache invalidation on series send success** invalidates `['bookingCommunications', bookingId]` for the initiating booking and its sibling member bookings, replacing #847's explicit no-op (which was correct only because no row was written).

## Consequences

- `AttachmentLink` in `CommunicationsSection.tsx` currently builds its PDF link from `comm.bookingId` directly (`/bookings/${comm.bookingId}/invoices/...`) — this breaks for a series row (`bookingId` null) and must branch to the series document route established by #830 (`GET /series/:id/invoices/:invoiceId/document` → `/documents/:id/download`).
- The `Communication` glossary entry in `CONTEXT.md` ("a log entry for a communication associated with a Booking") is now inaccurate and is updated alongside this ADR.
- Acceptance criterion "a series send failure surfaces to the musician the same way a booking send failure does" is reworded: the toast/error surfacing already works today via the unhandled `mail.send` throw; what's new is that the failure is *persisted* as a `FAILED` Communication row (matching the booking path's `PENDING`→`SENT`/`FAILED` lifecycle).

## Alternatives considered

- **Dedicated series-scoped card** (mirroring `SeriesInvoiceCard`, #830's pattern exactly). Declined in favor of the existing list — no separate component, hook, or query to maintain for a second, parallel history.
- **Client-side merge** of two separate queries (`useBookingCommunications` + a new `useSeriesCommunications`). Rejected in favor of a single server-side merged query — keeps the frontend hook and component unchanged and avoids a second network round-trip on every booking page load.
- **DB `CHECK` constraint** for the bookingId/seriesId XOR. Considered as an improvement over `Invoice`'s precedent, but rejected to keep the two polymorphic FKs consistent rather than have one enforced at the DB and one only in code.
