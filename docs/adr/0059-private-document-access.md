# ADR-0059 — Private document access via a second bucket and access-controlled redirect endpoints

## Status
Accepted. **Supersedes ADR-0009.**

## Context
ADR-0009 put all R2 objects — musician logos/photos, contract PDFs, invoice PDFs — in a single **public** bucket, guarded only by unguessable UUID keys. It explicitly scoped that decision to MVP ("not acceptable for a privacy-sensitive production deployment") and named the reversal path: a private bucket with presigned GETs, portal endpoints validating the `portalToken`, deferred to P2.

That condition has now arrived. Production was wiped clean for launch (#646), and the moment real customers exist, the bucket will carry genuine PII: signed contracts contain the customer's name, IP address, and signature; invoices contain financial data. Today a leaked, logged, or forwarded URL exposes such a document **indefinitely, to anyone, with no auth and no revocation** — the UUID is the only barrier.

The objects fall into two distinct sensitivity classes, which is what shapes the design:

- **Documents** — contracts, invoices, uploads, song lists. Real PII. Must be access-controlled.
- **Assets** — musician logos and photos. Low-sensitivity branding, and consumed in places that *cannot* tolerate an expiring URL: embedded **server-side** into contract PDFs via `fetchAsDataUrl`, and rendered as `<img src>` in emails that have **already been sent** and sit in customer inboxes forever.

A single R2 bucket has one privacy setting, so the two classes cannot share a bucket once one must go private.

Three access mechanisms were weighed for the private class:

1. **UUID-obscurity as-is** — reconsidered and rejected; it is the exact exposure this ADR closes.
2. **Presigned URL baked into the API payload** — simple, but the URL *is* a bearer credential for its whole TTL (leaks with the payload) and goes stale while a page sits open (mint a 10-min URL, client clicks 20 min later → broken).
3. **Stable API endpoint that signs at click-time** — the payload carries only an app route; the endpoint checks access per-request, mints a tight-TTL presigned GET, and 302-redirects to R2 so R2 still serves the bytes (no proxying of ~MB PDFs through the API).

## Decision

**1. Two buckets, split by sensitivity class.**
- The existing public bucket (prod `gigman`) stays public and holds **Assets** only (logos, photos).
- A **new private bucket** (public access disabled) holds all **Documents** (`CONTRACT`, `INVOICE`, `SONG_LIST`, `UPLOAD`). Its objects are reachable only via signed requests.

**2. Documents are served through access-controlled API endpoints (mechanism 3).** The `url` field returned by `documents.service` and `portal.service` is an **app route**, not a public R2 URL. On request the endpoint validates access, mints a short-TTL (~60s) presigned GET, and 302-redirects to the private bucket:
- **Admin:** `GET /documents/:id/download` — Clerk-guarded, scoped by `userId` like every other admin route.
- **Portal:** `GET /booking/:token/documents/:id` (plus a signed-contract variant) — `@Public()`, validates the `portalToken` exactly as the rest of `portal.controller.ts` does. This is the "portal download endpoints validate the `portalToken` before issuing" that ADR-0009 named.

**3. Assets remain public and unchanged.** `getPublicUrl` continues to serve logos/photos from the public bucket, because their consumption (server-side PDF embedding, already-sent email `<img>` tags) is incompatible with expiring or auth-gated URLs.

The zero-migration timing is deliberate: prod was wiped, so there are no existing objects to relocate and no dual-read window — new writes route to the correct bucket from day one.

## Consequences
- Contracts, invoices, uploads, and song lists are no longer world-readable. Access requires a live admin session (ownership-scoped) or a valid portal token — the same trust boundaries that already gate every other read of the same data.
- The presigned GET is minted only *after* the access check and lives ~60s — long enough to cover the redirect round-trip, too short to be a useful leaked credential. The app route in the payload carries no secret.
- Frontend download code is unchanged: `<a href={url} download>` still works; only the meaning of `url` changes (app route → 302 → R2).
- The email flow is unaffected: invoices and song lists are attached as PDF **buffers**, and emails link to the token-guarded **portal**, never to a document URL. Logos embedded in email remain public assets.
- `StorageService` must address two buckets (a private-documents target alongside the public-assets one) and gains a presigned-GET method. Callers that today build a public document URL switch to emitting the app route.
- The portal API contract changes shape: `signedContractUrl` and `documents[].url` become access-controlled app routes rather than public R2 URLs (CONTEXT.md amended).
- **Assets are the residual public surface.** Logos/photos stay guessable-by-URL; accepted, because they are the musician's own outward-facing branding, not customer PII.
