# ADR-0009: R2 bucket is public for MVP; presigned GETs deferred to P2

## Status
Superseded by [ADR-0059](0059-private-document-access.md) — documents moved to a private bucket served via access-controlled redirect endpoints; the public bucket now holds only assets (logos/photos).

## Context
GigMan stores files in Cloudflare R2: musician logo, musician photo, contract PDFs, and invoice PDFs. Portal clients are unauthenticated (Clerk is bypassed for `/booking/:token` routes), so any file that a portal client needs to access cannot be fetched via a Clerk-gated API endpoint without extra indirection.

Two options:
1. **Public bucket** — objects are accessible to anyone who knows the URL. URLs contain UUIDs, making them unguessable. Simple to implement; no TTL concerns.
2. **Private bucket + presigned GETs** — objects are private; the API generates short-lived signed GET URLs on demand. All downloads route through an authenticated (or portal-token-validated) endpoint. More secure; adds complexity to every download flow.

## Decision
Use a **public bucket** for MVP. All stored objects (logo, photo, contract PDFs, invoice PDFs) are accessible via `${R2_PUBLIC_URL}/${key}`. Storage keys incorporate UUIDs to prevent enumeration.

## Consequences
- Download flows are simple: store the key, construct `${R2_PUBLIC_URL}/${key}`, return as a URL field.
- For a production-hardened release: migrate to a private bucket, generate presigned GET URLs per-request, and ensure portal download endpoints validate the `portalToken` before issuing them. This is explicitly deferred to P2.
- Until that migration, contract and invoice PDFs are accessible to anyone with the URL. Acceptable for MVP; not acceptable for a privacy-sensitive production deployment.
