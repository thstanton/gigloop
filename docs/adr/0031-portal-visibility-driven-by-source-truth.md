# ADR-0031 — Portal visibility is driven by source truth, not checklist item state

**Status:** Accepted
**Date:** 2026-06-04

## Context

`portal.service.ts` determines what each section of the client-facing Portal renders by reading booking state directly — `activeContract.status`, `!!musicFormConfig`, `!!musicFormResponse`, and so on. CodeScene flagged the service as a complexity hotspot, and during a refactoring session we asked whether the existing `BookingChecklistItem` model could simplify this.

The specific hypothesis was: `completedBy: CUSTOMER` items already encode "the client does this action." If the musician opts out of a CUSTOMER item (by disabling it in their checklist defaults), they are implicitly opting out of that portal interaction. The portal could therefore read checklist item state rather than raw booking fields to decide what to show.

## Decision

Portal section visibility remains driven by source truth. Checklist item state is not used to gate portal sections.

Two concrete problems rule out the current item model as a visibility signal:

1. **SKIP rules conflict with client needs.** `contract_signed` transitions to SKIPPED when the booking reaches READY status — a musician-workflow signal meaning "this step is no longer relevant." But the client may legitimately want to download their signed contract long after READY. SKIPPED on the checklist does not mean "hide this from the client."

2. **Item state is too coarse for portal readiness.** `contract_signed` PENDING does not distinguish "contract is in DRAFT — no portal action yet" from "contract is in SENT — show the signing form now." The portal gates on `activeContract.status === 'SENT'` for this reason. Item state alone cannot carry the signal.

More broadly: the checklist is a musician-facing workflow tool; the portal is a client-facing product. Making one control the other couples them in a way that is non-obvious to the musician (disabling a checklist item would silently alter what their clients see) and fragile to future checklist changes.

## Future direction

This decision should be revisited when the band member portal ships. The envisioned model is richer: the checklist becomes a genuine multi-stakeholder project management tool, with `completedBy` values including `BAND_MEMBER` alongside `USER` and `CUSTOMER`. In that world, each stakeholder portal (client, band member) could plausibly surface only the items assigned to that stakeholder.

For that model to work cleanly, item state would need to be more granular — distinguishing "assigned and not yet available to the client" (contract DRAFT) from "assigned and ready for client action" (contract SENT). Whether that means enriching item state, adding a separate `portalVisible` flag, or deriving visibility from a combination of item state and booking field is left open.

Until then: portal visibility reads source truth directly, and the checklist evaluator is notified of client actions via `evaluator.evaluate()` after mutations rather than before.

## Contrast: Dashboard Actions widget

The Dashboard Actions widget (`GET /bookings/actions`, implemented in `BookingActionsService`) is the straightforward counterpart to this decision. It is musician-facing — the same audience as the checklist — and should be driven entirely by stored `BookingChecklistItem` state. Currently it predates the stored model: `BookingActionsService.computeActionItem` re-derives action readiness from raw booking fields (communications, invoices, contract status) using inline logic that duplicates the checklist evaluator. This is a known tech-debt item. The correct future state is: query upcoming bookings' `BookingChecklistItem` records, surface USER-completedBy items that are PENDING or FAILED and within the reminder window, and remove `BookingActionsService` entirely.
