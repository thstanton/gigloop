# ADR-0015 — Preferences as JSON columns on PublicProfile and UserProfile

**Status:** Accepted

## Context

`PublicProfile` was accumulating boolean visibility flags (`showContactPhoto`, `showContactEmail`, `showContactPhone`) alongside appearance fields (`brandColour`, `portalTheme`, `portalHeroImage`) as explicit columns. `UserProfile` had six flat `*ReminderDays` columns for checklist reminder windows. Both sets were projected to grow significantly as the app gains more user-configurable behaviour, subscription-gated features, and dashboard customisation.

Adding each new preference as an explicit column requires a DB migration, a Prisma client regeneration, DTO changes, and frontend type updates — disproportionate overhead for what is essentially a key-value preference store.

## Decision

Replace both sets of proliferating columns with typed JSON columns, validated by Zod at the API boundary:

- `PublicProfile.clientPortalConfig` (JSON) — all client portal appearance and behaviour preferences. Named `clientPortalConfig` (not `portalConfig`) to reserve namespace for future portals (e.g. `bandPortalConfig`).
- `UserProfile.preferences` (JSON) — all workflow and behaviour preferences: checklist defaults (including per-item reminder windows), and future preference domains (dashboard config, feature toggles).

The public/private split between `PublicProfile` and `UserProfile` is preserved — portal page loads never touch `UserProfile`, which matters for multi-tenancy correctness on unauthenticated routes.

Explicit columns remain for fields that are business data rather than preferences: identity fields on `PublicProfile` (businessName, email, photo, etc.) and operational fields on `UserProfile` (bankDetails, invoiceNumberSequence, depositTrackingMode, etc.).

## Consequences

- New preferences require no DB migration — add a key to the Zod schema and deploy.
- Subscription-tier gates are enforced at the API write boundary in application code; the schema does not encode entitlement requirements.
- Zod schemas are the authoritative type for each JSON column; `apps/web/src/types/api.ts` mirrors the shape as plain TypeScript interfaces.
- The former `*ReminderDays` columns on `UserProfile` are removed; per-item reminder windows live in `preferences.checklistDefaults[].reminderDays`.
- The former `showContactPhoto`, `showContactEmail`, `showContactPhone`, `brandColour`, `portalTheme`, `portalHeroImage` columns on `PublicProfile` are removed; their values live in `clientPortalConfig`.
