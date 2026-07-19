# ADR-0064 — One variable-substitution engine for rich-text bodies; subjects separate; body values escaped

## Context

"Substitute `{{var}}` from `EmailContext`" had **two** independent implementations that
had already begun to drift:

- `mail.service.ts` `renderTemplate` — rendered the Tiptap tree to an HTML **string**,
  then regex-replaced `{{\w+}}` on that string (with `\n`→`<br>`). `renderSubject` was a
  third copy of the same regex loop.
- `tiptap-portal.ts` `substituteTiptapVariables` — walked the Tiptap **JSON tree**,
  replacing `variable` nodes, feeding the HTML renderer and the pdfmake renderer.

Two problems followed. **Drift:** newline handling and escaping lived on the HTML path
only. **Injection (M3 sink 1, 2026-07-07 security review):** the HTML-string path
substituted context values (`customerName`, `venueName`, …) **unescaped** into
already-built HTML, so a contact/venue name containing markup was injected into the
outbound email body.

## Decision

**Substitute on the Tiptap tree once; HTML and pdfmake are pure output adapters over the
substituted tree.** The email body path becomes
`renderTiptap(substituteTiptapVariables(content, ctx))` and the regex-on-HTML loop in
`renderTemplate` is deleted. Because tree substitution produces text nodes, values pass
through the renderer's existing text-node escaping — **body variable values are now
HTML-escaped**, which closes the injection sink. This is an intentional behaviour change:
tests that pinned the old unescaped output are flipped, and a positive injection test is
added so the change reads as strengthened coverage.

**There are two substitution surfaces, not one — and that is correct:**

| Surface | Input | Escaping | `\n` | Feeds |
|---|---|---|---|---|
| Rich-text **body** | Tiptap tree | escaped (via renderer) | → `hardBreak` | HTML + pdfmake adapters |
| **Subject** | plain string | **raw — must not escape** | none | email header |

A subject is an email header (`Your quote from {{musicianName}}`); escaping `&`→`&amp;`
there would be a bug, and it must never get `<br>`. So subjects keep a **separate
plain-string substituter**. The two surfaces share only variable *resolution* — a single
`resolveVar` (fallback map + missing-variable tracking) — so the fallback catalogue and
missing-variable semantics cannot drift. The "one engine" claim is scoped to **bodies**;
do not "finish the job" by routing subjects through the tree.

**missingVariables** survives on the body path via an optional collector:
`substituteTiptapVariables(node, ctx, missing?: Set<string>)`. A key is recorded when the
**raw context value** is falsy — *before* the fallback is applied (an empty `bookingDate`
reports missing *and* renders "your event") — matching the old behaviour exactly. The
contract and signed-PDF callers pass no collector and are unchanged.

The substitution file is renamed `tiptap-portal.ts` → `tiptap-substitute.ts`; "portal" no
longer describes it (callers are mail, contracts, and documents).

## Scope

- **In:** the Tiptap-template substitution path (email body + subject, contract creation,
  signed-contract PDF).
- **Out:** the portal song-list email (`portal.service.ts` `buildSongListEmailBody`) — a
  hand-built string, not a template, so the tree fix has no surface to attach to. Its
  injection risk (M3 sink 2) is a separate issue (#691).

## Notes

- **`lineItems` node is dead.** The HTML renderer maps a `lineItems` node to literal
  `{{LINE_ITEMS}}`; the tree engine leaves it untouched. The two paths therefore differ on
  it — but `LineItemsNode` is registered in **no editor**, so no user can insert one, and
  no default template contains one. The case is unreachable through the product; it is left
  as-is with no preservation work.
- CONTEXT.md is unchanged: it already asserts "the same variable substitution logic" (L186)
  and that contract values are substituted "as plain text" (L96). This work makes the code
  honour what the glossary already says; the seam, adapters, and escaping are implementation
  and belong here, not in the glossary.
