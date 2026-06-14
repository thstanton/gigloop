# ADR-0038: PDF Document Design Direction

**Status:** Accepted — **amended 2026-06-14** (title font Caveat → Playfair Display; see Amendment below)  
**Date:** 2026-06-12

## Context

GigMan generates three system PDFs — invoice, signed contract, and song list. All three used Roboto with a generic functional layout that did not match the premium, wedding-stationery aesthetic of the rest of the application. A design upgrade was needed.

## Decision

One shared design applies to all musicians and all three document types. Per-theme variants (tracking the musician's portal theme) are deferred to P2.

### Typographic hierarchy

- **Document title** ("Invoice", "Contract", "Music Requests"): Caveat at ~36pt, positioned as a standalone display element between the header and the body content — not inside the header. This is the single expressive moment on the page.
- **All body text, section labels, metadata:** Commissioner. Caveat does not appear elsewhere.
- Font files (Caveat and Commissioner TTFs, OFL licensed) are bundled in `apps/api/src/documents/fonts/` and registered with pdfmake the same way Roboto is today.

### Page structure

Every PDF shares the same three-zone layout:

1. **Header:** logo left, business name + contact info right. Separated from the document body by a thin rule in the musician's `brandColour` (fallback: `#1a1a1a`).
2. **Body:** document-specific content, with hairline section dividers in `#e5e5e5`.
3. **Footer:** "Powered by GigMan" — centred, small, muted — on every page. Text is a single constant, trivial to update when the product name or domain is finalised.

### Brand colour usage

`brandColour` from `PublicProfile.clientPortalConfig` is used as a single accent — the header rule only. This gives each musician's documents a personal tint without requiring per-theme layout variants.

### Document title names

| Document type | Title |
|---|---|
| INVOICE | Invoice |
| CONTRACT | Contract |
| SONG_LIST | Music Requests |

## Alternatives considered

**Per-theme PDFs (4 variants):** rejected as premature. The upgrade from Roboto-generic to Caveat + Commissioner is the real win; theme coherence can be added in P2 when there is clear demand.

**Keeping Roboto:** rejected. Does not match the application's aesthetic and gives client-facing documents a generic feel inconsistent with a premium CRM.

## Consequences

- Custom font TTFs add ~500 KB to the API build but give full typographic control.
- The header and footer are extracted as shared builder functions, making future per-theme customisation straightforward.
- "Powered by GigMan" footer is intentionally identical to the portal footer — consistent attribution across every client touchpoint.
- Font file sourcing: Caveat and Commissioner are Google Fonts under the OFL licence, which permits embedding in generated documents.

## Amendment (2026-06-14): title font Caveat → Playfair Display

**What changed:** the document **title** font is changed from **Caveat** to **Playfair Display** (medium/semibold at display size) across all three PDFs. Caveat is removed entirely — it was used only for the title (*"Caveat does not appear elsewhere"*). Body, labels, and metadata remain **Commissioner**. Page structure, brand-colour accent, footer, and document titles are otherwise unchanged.

**Why:** a user rejected the design — Caveat (the portal's "Romantic" display face) is too informal for a financial/legal document. The underlying principle: **system documents (invoice, contract) are formal, transactional artifacts and should not borrow the portal's expressive/romantic styling.** Playfair Display is a high-contrast serif that reads as appropriately formal and confident at title size.

Note this is independent of portal theme — PDF fonts were never theme-coupled (the only theme-derived element is `brandColour` on the header rule). The original "per-theme PDFs in P2" idea should be read with this principle in mind: expressive per-theme title fonts are likely **never** appropriate for invoices/contracts, even in P2.

**Mechanics:** bundle `PlayfairDisplay` TTF(s) (OFL) in `apps/api/src/documents/fonts/`, register with pdfmake in place of Caveat, update the `requiredFonts` guard list, and update the title style in the shared header/title builder. Mirror the registration change in `pdf-generation.spec.ts`.
