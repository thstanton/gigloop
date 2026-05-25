# ADR-0007: Communication status field (PENDING | SENT | FAILED)

## Status
Accepted

## Context
The original `Communication` model recorded only `sentAt` — implicitly, a record existing at all meant the send had succeeded. This had two problems:

1. **No failure record.** If Resend rejected the send, there was no persistent record of the attempt. A toast was the only feedback, which is ephemeral and insufficient for something as consequential as a contract email.

2. **No path to batch sending.** At scale, sending emails synchronously per-request is not sustainable. A queue-based model (create record as PENDING, worker processes and updates to SENT/FAILED) will be needed by P2.

## Decision
Add a `CommunicationStatus` enum (`PENDING | SENT | FAILED`) and a `status` field to the `Communication` model.

MVP synchronous flow:
- Record created as `PENDING` before the Resend call
- Resend succeeds → status updated to `SENT`, `sentAt` set to now
- Resend fails → status updated to `FAILED`, `sentAt` remains null

P2 async flow:
- Record created as `PENDING` and enqueued
- Worker processes the queue, updating to `SENT` or `FAILED`

`PENDING` is added now, ahead of its async use, because adding it later would require a migration with existing rows already in terminal states — adding it now while the table is empty is cost-free.

Existing rows (zero at migration time) are backfilled as `SENT` by the migration default.

## Consequences
- Failed sends are permanently recorded and visible in the UI with a distinct warning state
- The `BookingChecklist` only counts `status = SENT` communications as Done — `FAILED` and `PENDING` records do not satisfy the Done condition
- A `FAILED` checklist item shows a warning indicator ("Last send failed") rather than just Outstanding
- The retry path is possible in future (re-send from a FAILED Communication)
- P2 batch sending can be introduced without a schema migration
