# ADR-0085 — Appearance: a light and a dark rendering of the admin app

## Status
Accepted (2026-09-29). Decided via `/grill-with-docs`. **Takes up the dark mode that ADR-0011 deferred to P2**: ADR-0011 kept the MVP light-only on purpose ("Dark mode is a P2 option"), and this is that P2 option. It extends ADR-0011's palette and ADR-0039's contrast bar and leaves both intact. The term **Appearance** is defined in `CONTEXT.md`.

## Context
The admin app has one rendering: warm parchment, ink-dark serif, dark charcoal chrome. Musicians use GigLoop on a phone in dark venues and backstage, where a bright page is a real nuisance. The token system from ADR-0011 already puts almost every colour behind a CSS variable, so a second palette is mostly a matter of redefining those variables. The exceptions are about 21 admin files that use raw Tailwind palette classes (`bg-white`, `text-white`, `text-amber-600`…).

The one naming hazard is that **`theme` already means the portal preset** the musician picks for their client (`BOLD_MODERN`, `LIGHT_ROMANTIC`…), and some of those presets are dark. The new concept needs a different name.

## Decision

### 1. The concept is *Appearance*, and it is not a theme
Appearance is **Light / Dark / System**. `theme` keeps its portal meaning, and nothing in the admin app's appearance code is called "theme".

### 2. Admin app only
Appearance governs the authenticated admin app. It does **not** apply to:
- the client **Portal** or the **Band portal**, whose look is the musician's branding choice (ADR-0014) and not the viewer's preference;
- **portal previews inside the admin app** (the portal preview page, the theme picker's live preview), which show exactly what the client sees in either appearance;
- **emails and PDFs**, which are rendered server-side (pdfmake) and are always light;
- **print**, which is always light.

### 3. System by default, overridable per device
The default is **System** (follow `prefers-color-scheme`). The musician can override it to Light or Dark. The override is stored **per device**, in the browser's local storage, not in `UserProfile.preferences`. Appearance usually depends on context (a phone in a dark venue, a laptop at a desk), and storing it per device keeps the feature frontend-only. If people ask for cross-device sync, promoting it to `preferences.appearance` is cheap later.

The control lives in the **AppShell account menu**, plus a "Toggle appearance" command in the global command palette (ADR-0067). Clerk's hosted UI follows the app through its `appearance.variables`, mapped from our tokens by hand, with no `@clerk/themes` dependency.

### 4. The dark rendering is "the score under stage light"
The admin UI evokes a printed score on warm parchment. The dark rendering keeps that metaphor inverted: a warm near-black page with warm off-white "ink", the same serif and the same restraint. It is not a generic grey dark UI.
- **Chrome stays the deepest layer.** Content surfaces sit a step lighter than the chrome, so the hierarchy is kept by elevation.
- **Status colours keep their hue identity** (enquiry amber, confirmed teal…). Only lightness and saturation are retuned per appearance, including the translucent `bg-status-*/15` washes. The status vocabulary table is unchanged because its literal classes point at CSS variables. The date-badge red is retuned the same way.
- **Musician decorations** are inverted to light ink (it reads like a scratchboard or engraving), confirmed by a prototype. A figure that doesn't survive inversion is hidden in dark mode. We don't commission dark variants.

### 5. Same accessibility bar in both appearances
ADR-0039's WCAG AA requirement applies to **every token pair in both appearances** from day one, with no "dark is beta" exemption. It is proven deterministically by a **new** token-pair contrast check: a script that reads both palettes from `globals.css` and asserts AA for every declared text/surface pair, run in CI. Today's AA figures (the comments in `globals.css`) were worked out by hand, and the existing `check-design-tokens.mjs` is a class-name guard, not a contrast check. We don't run every story twice in CI. Storybook gains an Appearance toolbar switch for manual review.

### 6. Tokens first, then ship dark behind a flag
- **A token prefactor lands first**, as its own tracking issue with no visible change: raw palette classes in admin code become tokens, and a lint guard stops them coming back. Portal code, stories and specs are exempt, because the portal's colours derive from the musician's brand on purpose.
- **Appearance then ships behind a default-off env flag** (ADR-0044). **Flag off means always light:** the OS setting is ignored and the control is hidden, so a half-finished dark palette never reaches a musician whose OS is set to dark. The flag is switched on after a surface-by-surface review.

## Alternatives considered
- **Call it "theme".** Rejected because it collides with the portal `theme` preset, and some of those presets are themselves dark.
- **Appearance follows everywhere, including the portal.** Rejected because the portal is the musician's brand presented to their client. The viewer's OS setting must not repaint it.
- **Store the preference per account (`UserProfile.preferences`).** Deferred. It adds an API round trip and a DTO change for a choice that is usually per device anyway.
- **OS-only (no toggle) or toggle-only (no System).** Rejected because musicians need both: a sensible default, and a quick override when the room is dark and the OS doesn't know it.
- **A neutral grey dark palette.** Rejected because it would give the app two identities. The warm dark rendering keeps one brand in both appearances.
- **Dark-variant decoration artwork.** Rejected as unnecessary cost for ornament. Inverting the line art, or hiding a figure, is enough.
- **Fix hard-coded colours surface by surface during the dark work.** Rejected because it mixes a pure refactor with visual change and makes each dark-mode diff harder to review.
- **Run story interaction tests in both appearances.** Rejected because it doubles a suite that has been flaky before (#495) and proves little that the token-level contrast check doesn't.
- **Flag off means System-only.** Rejected because it would expose the unreviewed dark palette to every dark-OS user.
