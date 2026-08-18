# ADR-0070: Issuing is repairable when the stored artifact is missing

## Status
Accepted (2026-08-18). Refines ADR-0042 (Issued means finalised) and ADR-0056 (creation is draft; explicit issue is the verb). Applies to both invoice owners (ADR-0029).

## Context

`InvoiceTransitionService.issueInvoice` performs two writes that are not one unit:

1. `assignAndMarkIssued` / `assignSeriesAndMarkIssued` commits `status: ISSUED`, the invoice number, and the issue/due dates.
2. `generateAndStoreInvoicePdf` renders the PDF, puts it in R2, and creates the `Document` row.

Step 2 runs after step 1 has committed, and it can fail for reasons that have nothing to do with the invoice: a missing `PublicProfile`, a logo URL that fails the SSRF allowlist or the fetch (the failure mode of #769), or an R2 outage.

When it does, the invoice is **stranded**:

- It cannot be re-issued. `isIssuable` requires `DRAFT`, so the retry is rejected with *"Only draft invoices can be issued"*.
- It cannot be sent. `send` refuses with *"Issued invoice has no stored PDF — cannot send"*.
- It holds a consumed invoice number.

The only escape is to void it and create a fresh draft, which burns a number, leaves a spurious VOID row in the client's billing history, and is not discoverable from any error message the musician sees.

Both halves are already individually idempotent. `assignSeriesAndMarkIssued` early-returns when a number is present, and `generateAndStoreInvoicePdf` deletes any existing `Document` before creating the new one. Nothing but the `isIssuable` predicate prevents a clean retry.

The invariant this appears to threaten — *an Issued invoice is frozen; what was previewed is what is in Documents is what the client received* (ADR-0042) — is not actually in tension. An invoice with **no** stored artifact has no "what the client received" to preserve. There is nothing frozen to protect, because the thing that freezing exists to protect was never produced.

## Decision

**An ISSUED invoice with no backing `Document` may be issued again.** `isIssuable` admits an invoice that is either `DRAFT`, or `ISSUED` with no stored artifact.

This is a **repair**, not a re-issue:

- The invoice number, issue date and due date are **not** reallocated — step 1 is idempotent and returns the committed values.
- Only the missing artifact is produced.
- The moment a `Document` exists, the invoice is frozen again and the path closes. An ISSUED invoice that *has* its PDF can never be re-issued, exactly as before.

Nothing else about ADR-0042 changes. Issuing remains distinct from sending; the stored artifact remains the authority once it exists; preview-by-regeneration remains DRAFT-only.

## Alternatives considered

- **Generate the PDF before committing ISSUED.** Prevention rather than repair, and the more obviously correct shape. Rejected: the PDF must carry the invoice number, so the number has to be allocated (or previewed) first — which reintroduces the allocation race that issue-then-render currently avoids, and interacts badly with ADR-0028's void-number inheritance. More moving parts to fix a failure that a two-line predicate change already resolves.
- **Compensating rollback — revert to DRAFT and release the number on failure.** Clean transactional semantics. Rejected: number release is precisely the operation ADR-0028 already handles awkwardly, and a rollback that itself fails leaves the identical stranded state with more code between the musician and the fix.
- **Leave it; document void-and-recreate as the escape.** Rejected: the escape is undiscoverable from the error text, and it costs the musician a number and a phantom VOID row on a client-facing billing record for a failure that was never theirs.
- **Wrap both writes in one database transaction.** Does not help. The R2 put and the PDF render are not transactional resources; a database transaction would roll back the status while leaving an orphaned object in the bucket.

## Consequences

- `isIssuable` gains a dependency on whether a `Document` exists for the invoice, so it can no longer be a pure predicate over invoice fields alone. Either the caller supplies that fact, or the check moves into the service ahead of the pure guard — the latter keeps `invoice-transition-rules.ts` pure, which is worth preserving.
- The Issue action must remain offered (or become re-offered) on an ISSUED invoice whose document is missing, otherwise the repair path exists but is unreachable — the mirror of the #830 failure, where the artifact existed and the route to it did not.
- This is not a substitute for observability. A PDF generation failure is still an application error that should surface (#744); repairability makes it recoverable, not invisible.
- Applies identically to booking invoices, which share the code path and the same stranding risk.
