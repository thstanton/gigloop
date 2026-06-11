# ADR-0036: Sheet state in URL search params (discriminated union)

**Status:** Accepted
**Date:** 2026-06-11

## Context

`BookingDetailPage` previously managed ~10 independent `useState` boolean flags for sheet/dialog open state (`contractSheetOpen`, `invoiceSheetOpen`, `composeOpen`, `contractSheetReadOnly`, `seriesSheetOpen`, etc.) plus associated prefill state (`invoiceSheetPrefill`, `composeTemplateType`, etc.).

Only one sheet can be open at a time — the booleans were already logically a discriminated union, not truly independent. Modelling them as independent booleans allowed impossible states (two sheets "open" simultaneously) and scattered the coordination logic across the page.

## Decision

Sheet identity is encoded in a single `?sheet=<type>` search param. Prefill and context data (all URL-serializable) go as sibling params. Closing any sheet clears all params (`setSearchParams({})`).

**Sheet param shape:**

```
?sheet=invoice&isDeposit=true&amount=1500&description=...   (create invoice)
?sheet=invoice&invoiceId=<uuid>                              (edit invoice)
?sheet=compose&templateType=contract_cover
?sheet=bookingEdit                                           (booking edit drawer)
?sheet=bookingEdit&section=onTheDay                         (scroll to section)
?sheet=contract
?sheet=contract&readOnly=true
?sheet=series
?sheet=customerMismatch&seriesId=<uuid>&warning=<encoded>
?sheet=contactEdit&contactId=<uuid>
?sheet=markSent&invoiceId=<uuid>
(no sheet param) = nothing open
```

The `editSection(section)` helper collapses into `setSearchParams({ sheet: 'bookingEdit', section })`.

**Not in URL params:**

- `pendingContract` — a full `Contract` object returned by the create-contract mutation callback; not URL-serializable. Kept as `useState`.
- `selectedSeriesId` — transient input within the series selector dialog. Kept as `useState`.
- `viewingMusicFormResponse` — a query-enable flag, not a user-opened sheet. Kept as `useState`.
- `readyDialogStatus` — computed from checklist state in `useBookingChecklist`; auto-triggered, not user-opened. Kept in the hook.

## Consequences

- Only one sheet can be open at a time (impossible states eliminated).
- Back button closes the open sheet for free.
- Deep-linking to a sheet is possible (e.g. share a URL that opens the contract).
- Prefill state survives page refresh (useful for invoice pre-population).
- Removing boolean sheet `useState` from the page eliminates the god-object coordination problem.
- `BookingEditDrawer` reads `?sheet=bookingEdit` instead of `?edit=true`. `ContactEditDrawer` on the contacts page is unaffected (it is a separate feature with its own `?edit=true` convention).
