# ADR-0039: Accessibility Approach — Admin App, WCAG 2.1 AA

**Status:** Accepted  
**Date:** 2026-06-13

## Context

Before MVP launch, a pass was made to bring the admin app to WCAG 2.1 AA compliance (due diligence, no specific known user need). The portal was deprioritised relative to the admin app given the greater UI complexity of the latter.

The audit found the component primitives (Radix UI) already handle focus trapping and ARIA roles for dialogs, selects, tabs, and tooltips. The gaps were in form error wiring, navigation semantics, focus return after sheet close, icon annotations, a skip link, and one contrast failure.

## Decisions

### FormField error wiring
`FormField` was updated to call `useId()` internally and wire the generated id to the input (`id`), label (`htmlFor`), and error paragraph (`aria-describedby`). `aria-required` is set when the `required` prop is passed. No call-site changes required.

### Skip link
A visually-hidden skip link (`<a href="#main-content">Skip to main content</a>`) was added to `AppShell.tsx` above the navigation. It becomes visible on focus. The `<main>` element gained `id="main-content"`.

### Focus return after sheet/dialog close
ADR-0036 introduced URL search params as the open/close mechanism for most booking-detail sheets. This breaks Radix's automatic focus-return, because Radix's modal Dialog calls `event.preventDefault()` in its internal `onCloseAutoFocus` handler when `context.triggerRef` is null (i.e. no `<SheetTrigger>` rendered), cancelling `FocusScope`'s own `previouslyFocusedElement` restore.

Fix: `SheetContent` in `components/ui/sheet.tsx` composes `onOpenAutoFocus` and `onCloseAutoFocus` directly on `SheetPrimitive.Content`. `onOpenAutoFocus` fires before Radix calls `focusFirst()`, so `document.activeElement` is still the trigger button at capture time. `onCloseAutoFocus` restores it and calls `e.preventDefault()` to suppress Radix's null-trigger → body fallback.

This is implemented once in the shared `SheetContent` primitive, covering all sheets in the app — the 8 URL-param-driven sheets and the ~9 trigger-based ones — with no per-call-site wiring. No `useFocusReturn` hook or capture/restore calls are needed at call sites.

### Navigation aria-current
React Router's `NavLink` sets `aria-current="page"` automatically when active. Verified present; no change needed.

### Booking list filter buttons
The status filter buttons (`All`, `Enquiry`, `Confirmed`, …) in `BookingsListPage` were converted to `role="tablist"` / `role="tab"` with `aria-selected`. Arrow-key navigation between filters is the expected interaction model for a horizontal tab bar, and it matches the visual shape better than `radiogroup` (which users associate with vertical radio inputs).

### Icon aria-hidden
Decorative Lucide icons in the navigation (`AppShell.tsx`) and the select chevron (`select.tsx`) were annotated `aria-hidden="true"` at their call sites. No wrapper component was introduced — the `IconButton` component already covers the meaningful-icon-with-no-text case; everywhere else the icon is alongside visible text and the annotation is polish.

### Contrast
`text-muted-foreground` (`hsl(30 8% 48%)`) is 4.20:1 against white — fails AA for normal text but passes the 3:1 threshold for UI components. The only failing interactive text element was the back link in `PageHeader`, which was changed from `text-muted-foreground` to a value that passes 4.5:1. The global token was left unchanged to avoid a design-system-wide colour shift outside the scope of this pass.

> **Amended by #977 (2026-08-22) — the deferred colour shift has now happened.**
>
> `--muted-foreground` was a duplicate alias of `--muted` (identical HSL), which
> made every `bg-muted` + `text-muted-foreground` pairing render invisible text.
> Fixing that root cause required moving de-emphasised text onto the `--accent`
> surface (`hsl(35 18% 92%)`), where the old 48% lightness measured only
> **3.52:1** — worse than the 4.20:1 recorded above. The token was therefore
> darkened rather than left alone:
>
> - `--muted-foreground` is **deleted**; the sole token is `--muted`, and the
>   sole utility is `text-muted`. There is no `bg-muted` (a guard enforces it).
> - `--muted` is now `hsl(30 8% 40%)`.
>
> Measured against every **opaque** surface `text-muted` is used on:
>
> | Background | 40% (now) | 48% (before) |
> |---|---|---|
> | white | 5.64:1 | 4.18:1 |
> | `--background` | 5.42:1 | 4.02:1 |
> | `--surface` | 5.09:1 | 3.78:1 |
> | `--accent` | 4.75:1 | 3.52:1 |
> | `--dashboard-surface` | 4.69:1 | 3.48:1 |
>
> All clear AA for normal text, so on opaque surfaces the gap this section
> deliberately left open is closed, and the `PageHeader` back-link special case
> is no longer the only compliant use of the token.
>
> **A narrower gap remains, and is knowingly left open.** `text-muted` is also
> used on translucent washes of itself (`bg-muted/20`…`/50`, e.g. the VOID
> contract row and the VOID invoice pill). Composited over `--surface` these
> measure 3.93:1, 3.41:1, 2.94:1 and 2.52:1 — every one improved by the
> darkening, none reaching 4.5:1, and the `/40` and `/50` cases fall below even
> the 3:1 UI-component threshold. Restyling the VOID treatment is a design
> decision, not a token change, so it was left out of #977's scope rather than
> resolved silently. Do not read this amendment as blanket AA compliance for
> `text-muted`.
>
> `--status-complete` retains the original `hsl(30 8% 48%)` and is now a
> separate value; that decoupling is intended.

## Consequences

- All high and medium WCAG 2.1 AA gaps in the admin app are resolved.
- Focus return for future URL-param-driven sheets is automatic — `SheetContent` handles it. No hook or extra wiring is needed at call sites.
- `FormField` now requires no `id` prop — callers should not pass one (it would conflict with the internal `useId()` value).
- The portal accessibility pass is deferred to P2.
