# ADR-0054 — Portal visibility is computed by a single authority, consumed by both the portal and the admin indicator

## Status
Accepted (2026-06-22; amended 2026-06-24 — final indicator treatment + a second companion fix for the cancelled-booking contract leak; see below). Builds on [ADR-0021](0021-contract-portal-visibility-driven-by-status.md) (contract visibility driven by status), [ADR-0031](0031-portal-visibility-driven-by-source-truth.md) (portal visibility driven by source truth, not checklist state), and [ADR-0042](0042-invoice-issued-state-decouple-issue-from-send.md) (invoice `Issued` vs `Sent`). Anticipates #533 (music-form draft/Published). Sliced into issues #578 (core), #579 (leak fixes), #580 (per-document rows).

## Context

The admin booking detail page gives the musician **no consistent signal of what the client can currently see** on the [[Portal]]. Portal visibility today is governed by scattered, concern-specific rules, each correct in isolation but with no unified surfacing (issue #534):

- **Contract** — the signing section is visible while `SENT`, replaced by the signed-PDF download once `contractSignedAt` is set (ADR-0021).
- **Invoices / Documents** — an `INVOICE` document appears on the portal only once its invoice is `Sent`/`Paid`; `Issued`-but-unsent and `Void` are retained but hidden (ADR-0031 / ADR-0042).
- **Music form** — visible the instant it is turned on (`hasMusicForm = !!musicFormConfig`); no draft period (#533).
- **Booking summary** — always visible.

The musician must *know all of these rules* to predict what the client is looking at — a question they ask constantly around sending invites, issuing invoices, and finalising the contract. The complaint #534 raises is fundamentally one of **legibility**: the truth exists, but only in the portal renderer's head.

The naïve fix — have each admin concern card re-derive "is this visible?" from the booking fields it already holds — recreates the exact problem one layer up: a **second, divergent copy** of the visibility rules. The day a portal rule changes (e.g. #533 re-gating the music form on `Published`), the admin indicator would silently lie. The whole point of #534 is to *stop* visibility logic from being scattered; duplicating it into the frontend would betray that goal.

This is also consistent with where ADR-0031 pointed: its "future direction" anticipated a unified visibility signal once richer multi-stakeholder portals arrive.

## Decision

**Portal visibility is computed by a single backend authority, and both the client portal and the admin "Portal visibility indicator" read their verdict from it.**

1. **One authority.** The per-concern visibility computation (today spread across `portal.service.ts` — `activeContract.status`, `isPortalVisibleDocument`, `!!musicFormConfig`, booking-`Cancelled` handling) is consolidated so there is a single function/module that answers "is concern X visible on the portal right now, and if not, why?". The existing portal rendering is refactored to consume it (no behaviour change to the portal).

2. **Two consumers, same truth.** The admin booking detail payload returns a **per-concern visibility map** computed by that same authority — `{ contract: { visible, reason? }, musicForm: { visible, reason? }, documents: [{ id, visible, reason? }] }`. The portal renderer and the admin indicator are then provably consistent: they cannot disagree because they share the computation.

3. **The indicator is a passive mirror.** It reports visibility; it never changes it. The concern's own actions (send, issue) remain the only way to alter visibility. (See the [[Portal visibility indicator]] glossary entry.)

### Shape of the signal

- **Asymmetric — a badge for visible, a quiet hint for hidden.** Visible → a green "**Visible on Client Portal**" badge (Lucide `Eye` + primary green, semibold). Hidden → a muted "**Not visible …**" hint (Lucide `EyeOff` + grey), naming the *portal* gate ("until sent", "— voided", "to client", "— cancelled") in portal terms — **not** communication history (the musician tracks their own sent mail; this signal is strictly about what the portal surface renders). The hint deliberately mirrors the badge's own word *visible*, so it inherits the "Client Portal" anchor without repeating it. The visible state is the prominent one (heightened awareness: "your client is looking at this now"); the hidden hint is subordinate.
- **Reason codes are retained** to drive the hint copy. The API stays display-agnostic — it returns a stable `ReasonCode`, never English — and the reason → copy map lives frontend-side.
- **Concerns are flagged where visibility is *non-obvious*.** The always-visible booking summary carries no indicator — its visibility is obvious, nothing to predict. A concern whose visibility is gated (contract, invoices) or *silently private among visible siblings* (an UPLOAD doc sitting in a documents list next to client-visible rows) **is** flagged, because the musician cannot tell at a glance. This both disambiguates "not a portal concern" (no flag) from "a portal concern currently hidden" (flag, hidden state), and reassures in the mixed-list case ("is my agent contract visible?!" — the exact anxiety #534 names).
- **Granularity follows the concern.** Singletons (contract, music form) → one card-level indicator. Lists (invoice / document rows) → one indicator **per row**, because each document is gated independently.

### Per-concern mapping

| Concern | State | Indicator |
|---|---|---|
| Contract | booking CANCELLED (any contract state) | Not visible — cancelled *(outermost gate)* |
| Contract | DRAFT | Not visible until sent |
| Contract | SENT / SIGNED | Visible on Client Portal |
| Contract | VOID | Not visible — voided |
| Music form | on (config exists) | Visible on Client Portal |
| Music form | off | (no indicator) |
| INVOICE doc | Sent / Paid | Visible on Client Portal |
| INVOICE doc | Issued (unsent) | Not visible until sent |
| INVOICE doc | Void | Not visible — voided |
| CONTRACT doc | signed, active contract | Visible on Client Portal |
| CONTRACT doc | superseded (its contract VOID) | Not visible — voided |
| SONG_LIST doc | — | Visible on Client Portal |
| UPLOAD doc | — | Not visible to client |

Booking `CANCELLED` is the **outermost** gate on the contract concern — it takes precedence over the contract's own state, so a cancelled booking's contract always reads "Not visible — cancelled". The signed-contract PDF is badged in **two** places (ContractCard + its document row); both are true, describing two surfaces.

### Companion fixes: two portal leaks the authority closes

Consolidating the scattered rules surfaces two pre-existing leaks. Both are deliberate behaviour changes, closed by routing the portal through the authority, and bundled into a single slice (issue #579):

**UPLOAD documents.** `isPortalVisibleDocument` currently ends in `return true`, and the portal document query (`portal.repository.ts`) loads `documents` with **no `where` filter on type** — so **UPLOAD documents are shown on the portal today** (the upload feature is built; the `as 'CONTRACT' | 'INVOICE' | 'SONG_LIST'` cast in the portal documents mapping is a compile-time fiction masking the UPLOAD case). A musician uploading an agent contract exposes it to the client, contradicting CONTEXT's description of UPLOADs as private paperwork. UPLOADs become never client-visible (per-document client sharing is a possible future feature, not current behaviour).

**Cancelled-booking contract.** Cancelling a booking only sets `status = CANCELLED` — it does **not** void the contract — and the portal renders the signing CTA whenever the contract is `SENT`, with no booking-status check. So **a client can currently sign the contract for a cancelled gig.** CONTEXT already (falsely) claimed signing was hidden on cancelled bookings; this makes that true. The fix makes booking-`CANCELLED` the **outermost** gate on the contract concern: the portal suppresses the signing CTA, the signed-contract download, **and** the contract document row on a cancelled booking. Scope is **contract-only** — invoice documents keep their existing gate (a cancelled gig may still carry a legitimately-owed cancellation-fee invoice the client must pay) and the always-visible booking summary is unchanged. This deliberately reverses the prior behaviour where a signed-contract download remained visible on a cancelled booking (CONTEXT's "Cancelled bookings" entry is updated to match).

### Surface and rendering

- **Detail page only** for now (not the create form — no portal exists pre-creation; not the Builder edit surface — the question "what can my client see?" is a read-surface question).
- A single new shared component, **`components/common/PortalVisibility`**, is the only rendering home — guaranteeing the cross-concern consistency #534 demands. Treatment (settled via prototype): **icon + coloured text, never a chip or enclosure, and no new palette hue.** A tinted/bordered chip would mimic the status pill and collapse the two axes, so the `Eye`/`EyeOff` icon is the axis differentiator and colour only signals how prominent "visible" is. Visible = green `Eye` + "Visible on Client Portal"; hidden = muted `EyeOff` + "Not visible …". A reserved new accent hue and an enclosing pill were both prototyped and rejected — they read as "just another status" beside the existing status pills.

## Consequences

- **Legibility without coupling.** The musician sees portal state at a glance; the checklist↔portal coupling ADR-0031 rejected is not reintroduced (the indicator reads source truth, not checklist state).
- **#533 lands in one place.** When the music-form draft/Published model arrives, only the authority's music-form gate changes; both the portal and the indicator update with **no #534 rework**. Until then the music-form indicator only ever reads "Visible" — a thin signal that is itself a standing reminder the gap is unaddressed.
- **Two pre-existing leaks are closed** — UPLOAD documents, and the cancelled-booking contract (a client could previously sign a cancelled gig's contract).
- **The hidden state is a quiet hint, not a badge.** The earlier worry that flagging hidden concerns adds chrome is resolved by making the hidden state deliberately subordinate (muted `EyeOff` + short "Not visible …") while only the *visible* state is a prominent badge. This keeps the predictive "until sent" value at low visual cost. A faithful per-booking portal *preview* (#531) remains the complementary "see exactly" answer to this indicator's "know at a glance".

## Alternatives considered

- **Re-derive visibility in each admin card.** Cheapest; guarantees divergence from the portal renderer the first time a rule changes. Rejected — it re-scatters the very logic #534 exists to consolidate.
- **Admin reads the portal endpoint (`?preview=admin`) for truth.** Conceptually one source, but couples the admin detail page to the portal token/endpoint and returns client-shaped data the admin UI must re-map. Awkward; rejected.
- **Three-state lifecycle (Not started / Prepared-not-shared / Visible) on every concern.** Over-modelled — most concerns are genuinely binary; the only real "prepared but not shared" state is the music form, and only once #533 lands. The positive-badge-plus-muted-hint shape carries that nuance in the hint string instead.
- **Visible-only badge (no hidden hint at all).** Considered: drop the hidden state entirely so absence-of-badge means "not visible". Rejected because it loses the predictive "until sent" value — a `DRAFT` contract would look identical to a non-portal concern — and weakens the "is my agent contract visible?!" reassurance. The muted hint restores both at low chrome cost.
