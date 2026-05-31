# ADR-0028 — Invoice number slot reuse on void

**Status:** Accepted

## Context

Invoice numbers are assigned when an invoice is sent (`INV-{year}-{NNN}`, sequential per user per year). When a sent or paid invoice is voided and replaced — e.g. to correct an error — the replacement received a new sequential number, leaving a gap in the sequence. Musicians and their accountants expect sequential numbers with no unexplained gaps.

Two approaches were considered for gap prevention: (1) blank the number on void and decrement the sequence counter so the next invoice reclaims it; (2) keep the number on the void record and reuse it when a replacement is sent on the same booking. Option 1 requires counter manipulation that is error-prone for mid-sequence voids and strips the audit-trail number from the void record. Option 2 preserves the void record's number (audit trail intact) and requires no counter mutation.

## Decision

Voided invoices retain their `invoiceNumber`. When a new invoice of the same type (`isDeposit` flag) is sent on the same booking, the API checks for any VOID invoice of that type on the booking. If one exists, the new invoice inherits its number instead of incrementing the global sequence counter. If none exists, the counter increments as normal.

The global sequence counter is monotonically increasing — it never decrements.

At most one non-VOID invoice of each type (deposit: `isDeposit=true`; balance: `isDeposit=false`) may exist per booking. This constraint is enforced at the API level: attempting to create a second non-VOID invoice of the same type returns 409. This constraint is a prerequisite for slot reuse to be unambiguous — without it, multiple VOID invoices of the same type could carry different numbers, making the "which number to inherit" decision ambiguous.

Future invoice exports filter out VOID invoices, producing a clean sequential ledger with no visible gaps.

## Alternatives considered

- **Blank number on void + decrement counter:** the void record loses its number (audit trail weakened); counter decrement is correct only for the most recently issued invoice and undefined for mid-sequence voids.
- **Accept gaps:** simpler, but creates accounting friction — musicians expect their invoice run to be sequential.

## Consequences

- Multiple records may share the same `invoiceNumber` (one VOID, one active). This is intentional — the active record is canonical; the VOID record is historical. Exports must filter VOID invoices to produce a clean ledger.
- The `assignAndMarkSent` method gains a pre-check: query for a VOID invoice with matching `isDeposit` on the same booking; use its number if found.
- A creation guard is added to `POST /bookings/:id/invoices`: 409 if any non-VOID invoice with the same `isDeposit` value already exists on the booking.
