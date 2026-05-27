# ADR-0017 — Contract as a first-class entity with its own lifecycle

**Status:** Accepted

## Context

`contractContent` was previously a nullable Tiptap JSON field on Booking, and `contractSignedAt` was a timestamp on Booking. This worked for a single-contract-per-booking model but created a stuck state: once a contract email was sent, `contractContent` became read-only and there was no recovery path if the musician needed to correct an error (wrong fee, wrong date, wrong terms). The musician was unable to void and replace a sent or signed contract.

Additionally, `contractSignedAt` as a booking-level field conflated "a contract was signed" (a fact about a document) with the booking itself — making it unclear what happened to the signed state if the contract needed to be superseded.

## Decision

Promote Contract to a first-class entity with its own lifecycle: `DRAFT → SENT → SIGNED → VOID`.

A Booking has zero-to-many Contracts. At most one Contract per Booking may be in a non-VOID state at any time (enforced at the application layer). Old contracts are never deleted — voiding a contract preserves it in history and allows a new one to be created.

`contractContent` and `contractSignedAt` move off Booking and onto the Contract entity (`content` and `signedAt` respectively). The Booking's "active contract" is the single non-VOID Contract, if any.

## Alternatives considered

- **Keep `contractContent` on Booking, derive signed state from the Document record:** Rejected — this makes the signed PDF Document the authoritative source of a domain fact (was this contract signed?), which inverts the right relationship. The Document is an artefact produced when signing occurs; the Contract entity is the thing that was signed.
- **Allow in-place editing of sent/signed contractContent on Booking:** Rejected — silent mutation of a document the client may have already read or signed is misleading and legally questionable.

## Consequences

- A migration is required to move existing `contractContent` and `contractSignedAt` data from Booking into new Contract records.
- The Portal `GET /booking/:token/contract` endpoint returns the active (non-VOID) Contract's content; 404 if none exists.
- The "Create contract" checklist action creates a new DRAFT Contract (after voiding any existing non-VOID contract if one exists).
- Sending the contract email transitions the Contract from DRAFT → SENT.
- Client signing transitions SENT → SIGNED and sets `signedAt`.
- The musician can void any non-VOID Contract; voiding a SIGNED contract requires explicit confirmation (the client will need to re-sign a replacement).
- ADR-0013 (contract content pre-substitution) continues to apply — variables are substituted at Contract creation time, not at portal render time.
