# ADR-0021 — Contract portal visibility driven by Contract status, not Communication history

**Status:** Accepted

The portal's "Review & sign" CTA and signed contract download were originally gated on whether a `contract_cover` or `contract_and_deposit_cover` Communication existed (i.e. whether a contract email had ever been sent). We switched to driving visibility directly from `activeContract.status`: show the sign CTA only when `status = SENT`, show the signed download only when `status = SIGNED`, show nothing for DRAFT or when no active contract exists.

## Why the change

The Communication-based gate produced a stuck state: if a musician voided a signed contract and created a new DRAFT, `hasContractEmail` remained true (the old email still existed), so the portal continued to show "Review & sign" — but `GET /booking/:token/contract` would return the new DRAFT content, which the client should never see. There was no safe way to reset the portal state without deleting Communication records.

More fundamentally, the portal's contract UI is about the *current contract's* state, not the history of emails sent. A contract email is evidence that a contract was dispatched; it is not the source of truth for what the client should be able to act on today.

## Considered alternatives

**Keep Communication-based gate, add a reset mechanism:** Rejected — it would require explicitly voiding the "sent" Communication record when a contract is voided, coupling two independent lifecycle models. The Contract entity already carries the authoritative state.

**Expose contract status directly on the portal booking response:** Accepted — `activeContract.status` is returned as part of the portal booking payload; the frontend derives CTA visibility from it. `hasContractEmail` is removed from the portal response entirely.

## Consequences

- `GET /booking/:token/contract` returns 404 if `activeContract` does not exist or its status is not `SENT`. Previously it returned content for any non-VOID contract including DRAFT.
- Voiding a SENT contract immediately removes the "Review & sign" CTA from the client's portal without any additional cleanup.
- A future feature (checklist and booking status driving portal content visibility) will extend this pattern — see intent recorded in session 2026-05-29.
