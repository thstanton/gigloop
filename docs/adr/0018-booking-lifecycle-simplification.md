# ADR-0018 — Simplified booking lifecycle: remove Invoiced and Settled

**Status:** Accepted

## Context

The original booking lifecycle (`Enquiry → Confirmed → Invoiced → Settled → Completed`) mixed two concerns: genuine readiness stages and task-completion milestones. `Invoiced` and `Settled` were mechanically tied to specific actions (balance invoice sent, balance invoice paid) in a way that `Confirmed` was not (contract signed and deposit received were tracked separately as booking fields, not status transitions). This inconsistency was observed in UAT — musicians understood `Confirmed` as a readiness assessment but were unclear whether `Invoiced` and `Settled` meant they had to use the invoicing feature, or whether moving to those statuses required specific actions to have been completed.

With the introduction of `BookingChecklistItem` and the project-management paradigm, task completion is tracked at the item level. The booking status should reflect the musician's genuine assessment of readiness, informed by checklist items but never mechanically produced by them.

## Decision

Replace the six-status lifecycle with a four-stage model: `Enquiry → Confirmed → Ready → Complete` (plus `Cancelled` at any point).

- **Confirmed**: the engagement is committed (contract signed, deposit received). The musician advances manually.
- **Ready**: all pre-gig preparation is done. The musician advances manually when they feel genuinely prepared.
- **Complete**: post-gig admin is done. The musician advances manually.

`Invoiced` and `Settled` are removed. The financial progress they represented is now visible through checklist items (`create_balance_invoice`, `deposit_received`) and invoice records directly.

`Completed` is renamed `Complete` for consistency with the other status names.

## Migration

Existing bookings in `INVOICED` or `SETTLED` status are migrated to `CONFIRMED`. These bookings are committed engagements — their financial progress is visible through their invoice records. Migrating to `READY` would incorrectly assert that all pre-gig preparation is done, which cannot be verified without auditing each booking's checklist state.

## Alternatives considered

- **Keep Invoiced and Settled, add Ready**: Rejected — this would result in a six-status lifecycle with even more ambiguity about which statuses represent readiness vs. task completion. The goal is to make the lifecycle meaningful as a readiness signal, not a task log.
- **Derive status automatically from checklist completion**: Rejected — the lifecycle is the musician's assessment of readiness, not a mechanical output. Automatic transitions would remove the musician's agency and could produce incorrect states when checklist configuration varies per user.

## Consequences

- `BookingStatus` Prisma enum updated: remove `INVOICED` and `SETTLED`, add `READY`, rename `COMPLETED` to `COMPLETE`.
- Data migration required for existing bookings in `INVOICED` or `SETTLED` status → `CONFIRMED`.
- All code referencing `INVOICED`, `SETTLED`, or `COMPLETED` (status comparisons, UI labels, API responses) must be updated.
- The `statusGte` helper in the frontend must be updated to reflect the new ordering: `ENQUIRY < CONFIRMED < READY < COMPLETE`.
- Checklist items `create_balance_invoice` and `send_thank_you` gain `requiredForStatus: READY` and `requiredForStatus: COMPLETE` respectively as system defaults.
