# ADR-0014: Logo is a client-facing asset; admin top bar uses text

**Status:** Accepted  
**Date:** 2026-05-27

## Context

`PublicProfile.logoUrl` was introduced as a single field used in two places: the admin top bar (the musician's own UI) and the client-facing portal header. As the portal design matured, a third surface was added: PDFs (invoices, signed contracts, song lists).

The three surfaces have different requirements:
- **Admin top bar** — functional visual aid; the musician always knows whose account they're in; a text fallback (`businessName`) is entirely sufficient.
- **Portal header** — brand presentation to the client; needs to look good on both light and dark backgrounds; the primary reason a logo exists.
- **PDFs** — printed/formal documents sent to clients; same job as the portal: client-facing brand identity.

Portal and PDFs share the same job (client-facing brand). The admin top bar is the outlier.

An alternative was to split into two fields: `logoUrl` for admin and `portalLogoUrl` for client-facing. This was rejected because it creates two upload controls to explain, complicates the settings UI, and introduces the risk that musicians set one but not the other — producing PDFs with no logo while the admin shows one, or vice versa.

## Decision

`logoUrl` is a **client-facing asset** used on the portal and in PDFs. The admin top bar always renders `businessName` as text — `logoUrl` is never rendered in admin UI.

The settings page labels the upload "Logo (appears on portal and invoices)" to make its purpose unambiguous.

Portal configuration is accessed via the Portal Preview page (`/admin/portal-preview`). The logo upload lives in the "Business" section of the main settings page — accessible regardless of whether the portal feature is active — to ensure it remains discoverable for musicians who only use GigMan for invoicing.

## Consequences

- Single logo field, single purpose — no confusion about which image goes where.
- Logo is always reachable in settings even if the portal is disabled in future.
- Admin top bar loses the option to show a logo; `businessName` text is always shown instead. Acceptable since the admin is a tool for the musician, not a branded client experience.
- Any future "custom admin branding" feature would need a separate field.
