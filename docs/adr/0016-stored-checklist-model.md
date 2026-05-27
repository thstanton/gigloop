# ADR-0016 — Stored checklist model (BookingChecklistItem)

**Status:** Accepted

## Context

The previous `BookingChecklist` was a pure computed function (`buildChecklist.ts`) that derived checklist state at read time from booking fields, communications, and invoices. This worked for a fixed 10-item workflow but had several limitations:

- Opaque and non-declarative: the done/failed/irrelevant logic was encoded imperatively in one function, not visible to the user or configurable.
- No extensibility: adding a new item or changing an item's behaviour required code changes and deployment.
- No user customisation: musicians could not add custom items, reorder items, or opt out of items that don't suit their workflow.
- Reminder windows were flat `*ReminderDays` columns on `UserProfile` — each new item type required a DB migration.
- No support for multi-actor workflows: all items were implicitly completed by the musician; client portal actions (contract signed, music form submitted) were tracked as separate booking fields rather than checklist items.

## Decision

Replace the computed checklist with `BookingChecklistItem` — a stored entity seeded at booking creation from the musician's configured defaults (`UserProfile.preferences.checklistDefaults`). System defaults represent the existing 10-item workflow and are applied for users who have not configured their own defaults.

Each item has:
- Stored `state` (`PENDING | DONE | FAILED | BLOCKED | SKIPPED`) — authoritative; never computed at read time
- `autoCompleteRule` (JSON, optional) — when present, the system sets state to DONE when the rule condition is met on relevant business events; when absent, the item is manual-only. Rule types: `bookingField`, `communicationSent`, `invoiceExists`, `musicFormResponse`.
- `completedBy` (`USER | CUSTOMER | BAND_MEMBER`) — declares which actor resolves the item; routes the action to the correct interface
- `dependsOn` (`string[]`) — keys of items that must be DONE before this item transitions from BLOCKED to PENDING; evaluated automatically
- `requiredForStatus` (optional `BookingStatus`) — advisory association; the UI warns when advancing status with outstanding items, and prompts when all associated items are DONE. The API does not hard-gate status transitions.
- `reminderDays` (optional integer) — replaces the flat `*ReminderDays` columns; controls when the item surfaces in DigestNotification and Dashboard Actions

The musician's default checklist template lives in `UserProfile.preferences.checklistDefaults`. Custom items (no `key`) can be appended. Per-item reminder windows are configured there, replacing the former `*ReminderDays` columns entirely.

## Consequences

- The `buildChecklist.ts` frontend function is replaced by a direct query on `BookingChecklistItem` records.
- Business logic that previously triggered checklist state derivation (sign contract, send email, mark invoice paid) now also writes state to the relevant `BookingChecklistItem` record.
- Existing bookings require a one-time data migration to seed `BookingChecklistItem` records from their current state.
- Musicians can add custom checklist items to their defaults; these are seeded onto new bookings automatically.
- The system is extensible to future `completedBy` actors (BAND_MEMBER) without schema changes — the value is valid and ignored until the band member portal ships.
- Status transitions remain unconstrained at the API level; the `requiredForStatus` field is advisory only.
