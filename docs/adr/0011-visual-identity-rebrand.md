# ADR-0011 — Visual Identity Rebrand

## Status
Accepted

## Context

The initial design used Inter (body), Playfair (unused), a cool blue primary, and cool-gray neutrals — the default shadcn/Tailwind aesthetic. It is functional but completely generic. GigMan targets wedding and function musicians who run a personal business. Their world is elegant venues, printed contracts, and carefully curated stationery. The tool should feel native to that world, not like an accounts package.

## Decision

### Typography
- **Headings / display:** Playfair Display — used only at page-title and large entity-name scale (h1 equivalents, booking titles rendered large). Not used below that scale; Playfair at small sizes is illegible on mobile.
- **Body / UI:** Commissioner (variable font) — replaces Inter throughout. More refined and distinctive than Inter or DM Sans; the variable range allows weight tuning across heading, body, and label roles.

### Colour palette
- **Primary (interactive):** Deep forest green — rich, dark, high contrast on warm off-white. Approx `hsl(152, 45%, 25%)`. Used for buttons, links, focus rings, active nav states.
- **App chrome:** Forest green background on the sidebar (desktop) and top bar (mobile), with light text. Creates a strong visual anchor that immediately distinguishes the tool from the plain-surface default.
- **Neutrals:** Warm throughout. Background is barely-off-white (warm hue ~35–40, not cool ~220). Surface, borders, and muted text all shift from cool-gray to warm-gray. Warmth should be felt rather than seen — the green and typography carry the distinctiveness.
- **Foreground:** Warm near-black (slight warm undertone, not the current cool-blue near-black).

### Border radius
Sharp: **2px** everywhere — cards, buttons, inputs, popovers, badges. No `rounded-full` on interactive elements. Consistent with the editorial, stationery-like direction. Rounded corners are the generic SaaS default; sharp edges are the deliberate choice.

### Status badges
Replace the current barely-visible soft pills (`bg-status-xxx/12`, `rounded-full`) with **sharp rectangular badges** (2px radius): a 3px left-side accent border in the full status colour, and a lightly tinted background (15–20% opacity). Like a filing label or margin note — colour-coded and legible without being loud.

**Note on Confirmed status:** The current Confirmed colour is a bright green (`hsl(142, 71%, 45%)`) which will conflict with the forest green primary. Shift Confirmed to teal (`hsl(172, 55%, 40%)`) to maintain a "positive/go" reading while being clearly distinct from interactive elements.

### Desktop layout

The current layout constrains almost all pages to `max-w-2xl` (672px), left-aligned. On a wide monitor this uses less than half the screen.

**Two-panel pages:**

- **Booking detail** — 60/40 split. Left (60%): booking header, customer, venue, performance, music form, notes. Right (40%): checklist, invoices, communications, documents. Right panel is `sticky` with `overflow-y-auto` so it only scrolls when its content exceeds the viewport; left panel scrolls freely with the page.
- **Contact detail** — same 60/40 split. Left: contact info. Right: associated bookings (supporting context, not primary workflow).

**Dashboard** — distinct from other pages in two ways:

1. **Background:** A deeper warm surface (warm parchment/stone tone) that reads clearly as a "home base," distinct from the cream-white of content pages. Widget cards sit on this surface with a slightly lighter card background.

2. **Grid layout:** Two columns at `md+` — 50/50 split. Left: welcome message + Actions widget (future analytics widgets grow this column downward). Right: Calendar + Upcoming gigs stacked. Mobile remains a single column.

3. **Welcome message:** Displayed above the Actions widget. A Playfair Display greeting line ("Good morning, [first name]") followed by the user's next upcoming gig ("Your next gig is [title] on [date]"). Personal and contextual — the one piece of information a musician wants when opening the app.

**Single-column pages** (wider, centered):
- List pages (bookings, contacts): `max-w-6xl` centered
- Form/detail pages (settings, new booking, repertoire, templates): `max-w-3xl` centered

Mobile layout is unchanged — the two-panel split only activates at `md` (768px+).

## Alternatives considered

- **Dark theme:** Rejected for MVP. Light with warm neutrals is more readable on-the-go (mobile, between soundchecks). Dark mode is a P2 option.
- **All-sans typography (better sans only):** Considered staying sans throughout with a better font. Rejected — Playfair at display scale is the single biggest differentiator and fits the wedding stationery reference directly.
- **Muted/dusty green primary:** Considered. Rejected — muted greens look washed out on buttons and lose contrast on warm off-white backgrounds. Functional interactive elements need a confident colour.
- **Neutral chrome:** Considered keeping the nav warm off-white (blending with content). Rejected — lack of contrast between chrome and content was identified as the most obvious weakness of the current design. Green chrome resolves it.
- **Rounded-pill status indicators:** Current default. Rejected in favour of sharp rectangular badges — more consistent with the 2px radius system and more distinctive.

## Consequences

- Inter can be removed from the font stack entirely.
- Commissioner and Playfair Display must be loaded (Google Fonts or self-hosted).
- All shadcn component defaults (border radius, ring colour, primary colour) need updating in `globals.css` and `tailwind.config.ts`.
- The `rounded-full` pattern on status badges needs a dedicated component or utility class to enforce the left-border style consistently.
- The `--status-confirmed` token shifts from bright green to teal.
- Booking detail and contact detail pages require a structural layout change: the current single-column `max-w-2xl` wrapper becomes a two-column grid at `md+`.
- The right panel on both detail pages should be extracted into a clearly named layout slot, not inline grid columns, to keep the component structure readable.
- All other `max-w-2xl` page wrappers are widened to `max-w-3xl` (forms) or `max-w-6xl` (lists) and centered with `mx-auto`.
