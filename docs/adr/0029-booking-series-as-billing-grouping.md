# ADR-0029 — Booking series as thin billing grouping with polymorphic invoice ownership

**Status:** Accepted

## Context

Musicians who play regular residencies (e.g. a hotel lunchtime slot twice a week) bill all performances in a period on a single invoice rather than one invoice per gig. Gigs are added ad-hoc during the billing period, so the total is not known in advance. A mechanism is needed to group bookings for billing purposes.

Three structural options were considered:

1. **Grouping UUID on Booking (`residencyGroupId`)** — add a nullable UUID to Booking; invoices remain on a nominated "anchor" booking; other members resolve the invoice through a group query. Smallest migration, but the invoice sharing is a convention enforced by the application rather than the schema. Introduces subtle failure modes: application guards can have gaps (e.g. a musician accidentally creates a second invoice on a series member booking), and the "which booking is the anchor?" question has no canonical answer.

2. **Invert Invoice FK (`Booking.invoiceId`)** — remove `Invoice.bookingId`; add nullable `invoiceId` to Booking so multiple bookings can reference the same Invoice row. Structurally honest, but requires a breaking schema change to Invoice (non-nullable FK flip), breaks cascade delete semantics, and makes `isDeposit` meaningless for residency invoices while leaving the deposit/balance logic entangled everywhere.

3. **Thin `BookingSeries` entity with polymorphic Invoice** — a new first-class entity that owns the billing relationship. Invoice gains a nullable `seriesId` FK alongside the existing (now nullable) `bookingId`. Exactly one must be set. Invoice ownership is clean and explicit at the schema level; the existing per-booking invoice logic is unchanged for standalone bookings.

Option 3 was chosen.

## Decision

Introduce a `BookingSeries` entity. A series is a billing batch — it represents one billing period, not an ongoing residency relationship.

**`BookingSeries` fields:** `id` (UUID), `userId`, `createdAt`, `updatedAt`, `label` (String, required), `customerId` (FK → Contact, required — authoritative billing contact for the series invoice).

**Booking membership:** `Booking.seriesId` (nullable FK → BookingSeries). Membership may be set at booking creation or retroactively. Retroactive assignment is blocked if the booking has any non-VOID invoices — the musician must void or delete them first (409 with an explanation). If the booking's `customerId` differs from the series `customerId`, the API returns a warning (not a hard block) — the musician must explicitly confirm that they intend to add a booking whose performance customer differs from the series billing customer. The booking's own `customerId` is never modified by series assignment; `series.customerId` is the billing contact only. A booking belongs to at most one series.

**Invoice polymorphism:** `Invoice.bookingId` becomes nullable. `Invoice.seriesId` (nullable FK → BookingSeries) is added. Exactly one of `bookingId` or `seriesId` must be set — enforced at the application layer on creation.

**One series = one billing batch:** a series maps to a single billing period and carries at most one non-VOID invoice. Different billing periods are separate series. Series status is derived from the invoice — no stored status field.

**Series invoices:** `isDeposit` is always false. The deposit/balance distinction applies only to single-booking project invoicing. The "at most one non-VOID invoice per series" constraint replaces the per-booking "at most one of each `isDeposit` type" constraint for series invoices. Invoice line items are auto-generated at creation: one line per member booking (date + sets description + booking fee as amount), pre-populated and fully editable.

**No series contract:** residency arrangements are typically informal or handled through a booking agency. Contract ownership remains per-Booking. Extending series to own a contract is deferred.

**No series UI page:** the series has no dedicated admin page. It surfaces contextually within the Booking detail page. The Invoice section on any member booking shows the series invoice as a variant card — modifications carry a reminder that changes affect the whole series.

**Series creation:** implicit on first booking. When the musician creates a booking and marks it as part of a series, the series entity is created in the same operation. Subsequent bookings are linked to the existing series via a picker in the booking creation form.

## Alternatives considered

- **Grouping UUID only (Option 1):** no FK to an entity means no referential integrity, no clean ownership of the billing contact, and application-layer conventions that are harder to audit and enforce than schema constraints.
- **Invoice FK inversion (Option 2):** `onDelete: Cascade` semantics break, `isDeposit` becomes meaningless, and the entire invoice creation/send/PDF pipeline needs rethinking. The cost is disproportionate to the feature.
- **Richer residency entity (e.g. with its own contract, checklist, lifecycle):** residency arrangements are informal or agency-mediated; a rich entity adds modelling overhead for a flow that has almost no checklist beyond `play_the_gig`. A thin billing-only entity covers the actual need.

## Consequences

- `Invoice.bookingId` is now nullable. All invoice queries that assume a non-null `bookingId` must be updated.
- A new application-layer constraint: exactly one of `Invoice.bookingId` or `Invoice.seriesId` is set. This must be enforced in the invoice creation service and validated in the DTO.
- The "at most one non-VOID invoice" constraint is now context-dependent: per booking (with `isDeposit` type distinction) for standalone invoices; per series (no type distinction) for series invoices.
- Invoice number slot reuse on void (ADR-0028) applies only to booking invoices where `isDeposit` type matching is meaningful. For series invoices, the void-and-replace flow inherits the voided invoice's number unconditionally (only one slot per series).
- The invoice creation endpoint and service must branch on whether the new invoice belongs to a booking or a series.
- Booking detail page Invoice section requires a UI variant for series members.
