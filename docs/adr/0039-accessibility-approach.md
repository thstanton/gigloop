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
ADR-0036 introduced URL search params as the open/close mechanism for most booking-detail sheets. This breaks Radix's automatic focus-return (which works only when a trigger button is in the same render tree).

A `useFocusReturn()` hook captures `document.activeElement` before `setSearchParams(...)` opens a sheet, and restores focus on `onOpenChange(false)`. All 8 URL-param-driven sheets in `BookingDetailSheets.tsx` and `BookingEditDrawer.tsx` use this hook. The 9 button-triggered sheets (PackagesPage, ContactEditSheet, etc.) rely on Radix's automatic handling.

### Navigation aria-current
React Router's `NavLink` sets `aria-current="page"` automatically when active. Verified present; no change needed.

### Booking list filter buttons
The status filter buttons (`All`, `Enquiry`, `Confirmed`, …) in `BookingsListPage` were converted to `role="tablist"` / `role="tab"` with `aria-selected`. Arrow-key navigation between filters is the expected interaction model for a horizontal tab bar, and it matches the visual shape better than `radiogroup` (which users associate with vertical radio inputs).

### Icon aria-hidden
Decorative Lucide icons in the navigation (`AppShell.tsx`) and the select chevron (`select.tsx`) were annotated `aria-hidden="true"` at their call sites. No wrapper component was introduced — the `IconButton` component already covers the meaningful-icon-with-no-text case; everywhere else the icon is alongside visible text and the annotation is polish.

### Contrast
`text-muted-foreground` (`hsl(30 8% 48%)`) is 4.20:1 against white — fails AA for normal text but passes the 3:1 threshold for UI components. The only failing interactive text element was the back link in `PageHeader`, which was changed from `text-muted-foreground` to a value that passes 4.5:1. The global token was left unchanged to avoid a design-system-wide colour shift outside the scope of this pass.

## Consequences

- All high and medium WCAG 2.1 AA gaps in the admin app are resolved.
- `useFocusReturn` is a small reusable hook; it should be applied to any future URL-param-driven sheet.
- `FormField` now requires no `id` prop — callers should not pass one (it would conflict with the internal `useId()` value).
- The portal accessibility pass is deferred to P2.
