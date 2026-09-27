# apps/web — CLAUDE.md

Conventions for the React + Vite frontend. Loads when working with files under `apps/web`.
Repo-wide hard rules, branching, release and session conventions live in the root `CLAUDE.md`.
Note: creating a new file in `components/common/` or `components/ui/` requires approval — that rule
stays in the root `CLAUDE.md` because it can come up before any `apps/web` file is touched.

## Stories & component sequence

### Story requirement
A new page or component is not done until it has a `.stories.tsx` (presence is enforced by a CI scan — a component without a story fails CI). Story *tasks* are written into UI issues explicitly and sequenced **before** the component build, so the story is a review checkpoint (see `docs/agents/issue-authoring.md` and ADR-0023). Story *quality* follows the ADR-0024 tiers below.

### Story testing tiers (see ADR-0024)
- `components/ui/` — smoke: story renders, key elements visible
- `components/common/` — smoke + one `play` function covering the primary use case
- Feature presentational components — interaction `play` covering the primary happy path
- Page stories — smoke only

### Development sequence
For feature components, always build the presentational layer + story before the container (per ADR-0023). This ensures every new UI is reviewable in Storybook before logic is wired up.

## Data Fetching
- Use TanStack Query (`useQuery`, `useMutation`) for all data fetching. Never fetch in raw `useEffect`.
- Always gate queries with `enabled: isLoaded` (from Clerk's `useAuth()`) to avoid race conditions on page refresh where Clerk hasn't initialised yet.
- `queryFn` calls use `apiGet`/`apiPost`/etc. from `src/lib/api.ts`.
- Query keys are arrays: `['bookings']`, `['bookings', filter]`, `['contact', id]`, etc.
- Filter / sort state lives in URL search params (`useSearchParams`); components read the param and pass it into the query key so TanStack Query refetches when the filter changes.
- React Router loaders are used only for auth checks / redirects — not for data fetching.

## Mobile-first UI

GigLoop is used on phones. Design every screen for 375px first, then enhance for larger widths.

**Layout**
- AppShell provides a fixed top bar (h-14) + fixed bottom tab bar (h-16) on mobile. Content gets `pt-14 pb-16` automatically — never add extra spacing to account for these bars inside page components.
- On desktop (md = 768px+): sidebar replaces the bottom tab bar; top bar remains.
- Never use a breakpoint below `md` (768px) for structural layout changes (sidebar, tab bar, etc.).

**Responsive grids and rows**
- Default to a single-column layout. Use `sm:grid-cols-2` (640px+) only for short, related pairs (e.g. first name / last name).
- Never put more than 2 columns in a grid unless the screen is definitely wide enough.
- For rows that combine a label + input + suffix text (e.g. "30 days before event"): stack label above input/suffix on mobile using `flex-col sm:flex-row`. Never use `w-44 flex-shrink-0` labels in a single-line row — they overflow at 375px.
- Avoid `whitespace-nowrap` spans alongside wide inputs unless wrapped in a `flex-col` stack on mobile.

**Forms**
- Fields stack single-column by default. `sm:grid-cols-2` is the widest mobile breakpoint for field pairs.
- Textarea rows: 2–3 on mobile is usually plenty.
- Buttons align left, never centred, on mobile.

**Navigation**
- Primary nav (Dashboard, Bookings, Contacts, Repertoire) lives in the bottom tab bar on mobile.
- Secondary nav (Templates, Settings) is accessed via the "More" button in the tab bar.
- The "More" button highlights (text-primary) when the current route matches any secondary nav path.
- Never rely on a sidebar for navigation at mobile size.

## UI Rules
- No drop shadows except on overlays
- Borders are border-border (1px). No border-2, no ring.
- Use the Lucide icons from lucide-react. Do not import from any other icon set.
- Stick to the type scale. No text-sm for body — use text-base.
- Empty states get an icon, a heading, one paragraph, and one CTA. Nothing else. (Musician decorations are **not** an exception — see below.)
- **Musician decorations** (the woodcut figures, `<MusicianDecoration>`) appear at exactly **one approved site**: the stage-advance dialog. The launch screen and dashboard first-run block were designed but deferred (2026-08-21, after a `/prototype` pass) — see `docs/musician-decorations-grill.md`'s follow-up note. Adding a second site requires approval — it is not enough that a surface satisfies the rule below. Two constraints bound any future site: **at most one figure may be visible at a time** (so a whole page or a modal, never a card or section that can co-occur), and the figure is **drawn at random from the figure pool** each time it renders — never a fixed choice, and never bound to a domain concept or status. Empty states are excluded by decision, not by the rule. See `docs/musician-decorations-grill.md`.
- Forms use react-hook-form with a Zod schema. Validation messages render below the field in text-status-cancelled text-sm.

## Loading & Feedback States

Every mutation must surface loading state and failure to the user. Three tiers:

### Tier 1 — Inline save (form config, field edits)
- Button: `disabled={mutation.isPending}`, label changes to `"Saving…"`
- Success: brief inline `"Saved"` text (cleared on sheet re-open)
- Failure: inline error message below the button

### Tier 2 — State-changing async (send, void, delete, create, status transitions)
- Button: `disabled={mutation.isPending}`, label changes to describe the action (`"Sending…"`, `"Voiding…"`, `"Creating…"`, `"Deleting…"`)
- Success: UI reflects the new state (card updates, item disappears, navigation occurs) — no separate "Saved" inline
- Failure: toast via `toast({ title: '…', variant: 'destructive' })`

### Tier 3 — Low-stakes toggle (checklist complete/pending, small switches)
- Optimistic update: apply state change immediately via `onMutate`
- On error: roll back to previous state + show error toast
- No loading text on the trigger needed

### All tiers — mandatory
- **Never use raw `apiGet`/`apiPost`/etc. outside a `useMutation` for state-changing calls.** All mutations go through `useMutation` so loading state is trackable.
- **`onError` is required on every mutation.** Silent failures are never acceptable.
- Failure must always surface to the user — inline error or toast.
