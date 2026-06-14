# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GigMan — a CRM for musicians. Greenfield monorepo; SPEC.md is the source of truth for architecture and requirements.

## Stack

- **Frontend:** React + Vite + React Router v7 (`apps/web`)
- **Backend:** NestJS (TypeScript) + Prisma + Neon (serverless Postgres) (`apps/api`)
- **Auth:** Clerk (never implement custom auth)
- **File storage:** Cloudflare R2 (never write uploads to local filesystem)
- **Email:** Resend
- **PDF:** @react-pdf/renderer (executed in the API, streamed to client)
- **Monorepo:** npm workspaces

## Commands

Once set up, expected commands from repo root:

```bash
bun run dev          # start both apps in dev mode
bun run build        # build all workspaces
bun run lint         # lint all workspaces
bun run test         # run all tests
bun --filter @gigman/api run test -- --testPathPattern=<file>  # run single test file
```

## Hard Rules (from SPEC.md — never violate)

- **Auth:** Use Clerk exclusively. Never implement custom auth.
- **Prisma models:** Every model must include `id` (UUID), `userId` (String), `createdAt`, `updatedAt`.
- **Multi-tenancy:** Every API endpoint extracts `userId` from the Clerk JWT via a global `AuthGuard`. All DB queries are scoped to that `userId`. No endpoint may return cross-tenant data.
- **Primary keys:** UUIDs everywhere. Never auto-increment integers.
- File uploads go to Cloudflare R2 — never write to the local filesystem
- **Portal routes:** `/booking/:token` validates the booking's `portalToken` — these routes bypass Clerk auth entirely.
- **Communication templates:** Stored as Tiptap JSON; rendered to HTML with variable substitution at send time.
- **Contact deletion:** Blocked at API level if the contact has associated Bookings; return a clear error (409 response).

## Architecture Notes

The NestJS API uses a global `AuthGuard` applied to all routes except portal routes (`/booking/:token`) and health checks. The guard injects `userId` from the Clerk JWT into the request context, which all service-layer methods must use to scope their Prisma queries.

PDF generation runs in the API process using `@react-pdf/renderer` and the result is streamed directly to the client — do not generate PDFs in the frontend.

## Before Every Session
- Read SPEC.md before writing any code
- Confirm you understand the hard rules below before proceeding
- If anything in the task contradicts SPEC.md, flag it rather 
  than resolving it yourself

## Code Quality

Governing principle: **deterministic checks belong to automation; judgement belongs to planning; advisory tools inform, they don't trap.** See ADR-0030. Do not hand-run deterministic checks "to be safe" — that is the duplication that caused multiple passes. Trust the automation below.

### Deterministic gates (automated — do not run by hand)

```
commit (hook):  lint                          (changed workspace only)   — fast, blocking
push   (hook):  test + build                  (changed workspace)        — build subsumes typecheck
CI (→ main):    lint + test + build           (both apps)                — required gate
                integration                                              — informational only (continue-on-error)
```

There is **no pre-flight check and no pre-commit checklist.** Lint runs automatically at commit; test + build run automatically at push; CI re-runs everything. You never need to invoke these manually — if a hook fails, fix the cause and let the hook re-run.

> ℹ️ **Reality note (ADR-0040):** hooks live under `.githooks/` (committed). One-time opt-in required: `git config core.hooksPath .githooks`. Without it, hooks don't run and CI is the only gate. The **shortcut-detector** (blocks `--no-verify` bypasses) is pending in #412 — lint/test/build fire but the shortcut check does not yet.

### Advisory layer (CodeScene + /simplify — judgement, never a hard gate)

CodeScene is a **navigator, not a gatekeeper.** See ADR-0026 (amended).

- **Navigator (use proactively):** `list_technical_debt_hotspots_for_project` surfaces refactor targets. Refactoring is its **own deliberate work** — propose it as such; never cram a forced refactor into a feature commit.
- **At PR only:** run `analyze_change_set` once and **report the Code Health delta to the human.** A regression is a conversation, not an automatic refactor loop. Target is **"no meaningful regression,"** not 10.0.
- **`/simplify` is signal-driven**, not blanket: run it only on files `analyze_change_set` flags as regressed, plus any file that crossed ~300 lines this session.

There is **no per-file pre-flight `code_health_review` and no per-commit `pre_commit_code_health_safeguard`.** Those are removed.

### No silent shortcuts

I never silently lower the bar. If the only way forward lowers it — an `eslint-disable`, an `any` to dodge a type error, a story that asserts nothing, a weakened or skipped test, hacking around a failing check, marking a checklist item done that isn't — I **stop and surface the trade-off** for the human to decide. If a clean (possibly slower) path exists, I take it and note it. **Surfacing a blocker is a success, not a failure.**

**ESLint disables** are the canonical case: never add one without explaining the situation and getting explicit permission. The only pre-approved suppress is `@typescript-eslint/no-explicit-any` (with a mandatory inline comment explaining why). All other suppressions — including `react-hooks/exhaustive-deps` — require approval.

**Line count proxy:** Files over ~300 lines are a yellow flag and a `/simplify` trigger.

## Shared types
`apps/web/src/types/api.ts` is the single source of frontend-facing types.
It mirrors the API's DTOs as plain TypeScript interfaces — no `@prisma/client`
imports, Prisma `Decimal` appears as `string`, `DateTime` as `string`.
**Update this file whenever an API DTO changes.**
Frontend pages import types from here rather than declaring local interfaces.

## API Documentation
- Every DTO property must have an `@ApiProperty()` (or `@ApiPropertyOptional()`) decorator so Scalar stays accurate
- Update these decorators whenever a DTO field is added, removed, renamed, or changes type
- Controller methods must use `@ApiResponse()` (or the typed variants) to document all possible response shapes

## Validation
- All input validation belongs in DTOs using `class-validator` decorators (e.g. `@IsString()`, `@IsUUID()`, `@IsOptional()`)
- All type coercion/transformation belongs in DTOs using `class-transformer` decorators (e.g. `@Type(() => Number)`)
- Services must not re-validate fields already declared in DTOs — trust the DTO
- The global `ValidationPipe` (with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) strips undeclared properties and rejects invalid payloads before they reach the service

## Code Conventions
- TypeScript strict mode in both apps
- NestJS: one module per feature (contacts, bookings, songs, etc.)
- All API responses use a consistent shape — ask before deviating
- No any types without a comment explaining why
- Errors are handled at the controller level using NestJS 
  built-in HttpException classes
- Domain types and DTOs are kept separate
- **Shared constants:** Label maps and lookup constants (status labels, category labels, ordered enum lists) belong in `apps/web/src/lib/constants.ts`. Never define a label map inside a component or page file if it may be needed elsewhere. Never import shared values from a page file — move them to `lib/constants` first.

## Repository Pattern
Every feature module uses three layers:
- **Controller** (`*.controller.ts`) — request/response handling only; no business logic, no Prisma calls
- **Service** (`*.service.ts`) — business logic and orchestration only; no input validation (that belongs in DTOs)
- **Repository** (`*.repository.ts`) — all direct Prisma calls; no business logic

The service depends on the repository; the controller depends on the service.
All three are declared as providers in the feature module.

## Branching Strategy

### Model
Feature branches → `main`. No direct pushes to `main` — the GitHub ruleset enforces this for everyone including repo owner.

- **`feature/*` → `main`:** Lint, Test, Build required. Integration runs but is not a required check (informational only).

### Branch naming
- `feature/<issue-number>-short-description` — new functionality (references tracking issue number)
- `fix/<issue-number>-short-description` — bug fixes
- `chore/<short-description>` — tooling, dependencies, config (no issue number required)
- `docs/<short-description>` — documentation and process file updates (`CLAUDE.md`, `CONTEXT.md`, `docs/adr/`, `SPEC.md`)

### Planning gate (before any feature)
Non-trivial features start with a **planning pass** before any code: I draft the tracking issue + sub-issues per `docs/agents/issue-authoring.md`, and the human approves them. Trivial fixes (one file, no UI, no schema) skip the gate. This front-loads the reuse, story, slicing and dependency judgement into a calm, reviewable moment.

### Multi-issue features
A feature spanning several issues gets a **tracking issue** — an umbrella whose body lists sub-issues as a task list (`- [ ] #94 description`) with `Blocked by` links. It is the durable dependency map; I advance it one unblocked sub-issue at a time.

**One feature = one branch = one PR.** Sub-issues are *commits on that single branch*, not separate branches. Sub-issues are closed via `Closes #94, #95` in the PR description. **Never split a dependent feature into sibling branches** — squash-merge + dependent branches is a conflict footgun (it is exactly what corrupted the series feature; see ADR-0025). If a feature is genuinely too big for one reviewable PR, split it into **sequential** tracking issues — each its own branch → PR → merge *before the next starts*. Never parallel.

### Commit messages
Use [Conventional Commits](https://www.conventionalcommits.org/):
`<type>[optional scope]: <description>`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`

Examples: `feat(bookings): add checklist seeding on creation`, `fix(invoices): correct deposit tracking on send`, `ci: cache node_modules in GitHub Actions`

### One commit per issue — mandatory
**Each sub-issue is its own commit on the feature branch.** Never batch multiple issues into one commit.

- Complete one sub-issue fully (code + tests + story passing), commit it, then checkpoint (see Session Behaviour → session-stop).
- The commit message body must include `Closes #<issue-number>` so the issue is closed automatically on merge.
- Complete and commit sub-issues in dependency order.
- **Stories are part of the issue commit** — a new page or component commit is not complete without its `.stories.tsx` file. `chore(storybook):` commits are only for updating existing stories, never for adding a story that should have shipped with the original feature.

This keeps each commit a reviewable unit of work and CI bisectable, while the whole feature stays on one branch.

### My responsibilities (Claude Code)
- At the start of any feature session: confirm we are on the feature's branch, or create it; read the tracking issue to find the next unblocked sub-issue.
- Work **one feature branch at a time.** Do not open parallel sibling branches for a single feature — sub-issues are commits, not branches.
- Open the PR targeting **`main`** when the whole feature is done, with `gh pr create --base main`. Do not open a PR per sub-issue.
- Never push application code directly to `main`.

### Merging
- Squash merge only (configured in GitHub repo settings — disable merge commits and rebase merge).
- PRs require CI to pass before merging. Required checks: Lint, Test, Build. Integration runs on every PR but is not a required check.
- Only the user merges PRs.

### Branch protection (configure in GitHub → Settings → Branches)
Protect `main` with:
- Require a pull request before merging
- Require status checks: `Lint`, `Test`, `Build`
- Do not require approvals (solo project)

## Package Discipline
- Do not install new packages without asking first
- Do not add packages to solve problems that can be solved with what's already installed
- Use `bun add <package>` (never `npm install`) for all package installation

## UI Components

### Inventory pass — happens at issue authoring, not at coding time

The "which existing component do I use?" decision is made **when the issue is written**, not while coding (per `docs/agents/issue-authoring.md`). UI issues name the components to reuse so the human can catch a missed component at planning. At coding time, **build what the issue specifies.** This list is the reference for the planning-time inventory pass:

1. **`components/ui/`** primitives: `Button` (default/outline/ghost/destructive variants), `Input`, `Textarea`, `Select`, `Switch`, `Label`, `Badge`, `Separator`, `Sheet`, `Dialog`, `Tabs`, `Tooltip`, `Toast`
2. **`components/common/`** patterns:
   - `PageHeader` — page title + optional back link + optional subheading + optional action
   - `PageSection` — section heading (h2-level) within a page
   - `Card` — bordered container with optional title
   - `FormField` — label + input slot + error message
   - `EmptyState` — icon + heading + paragraph + CTA
   - `GhostButton` — small text-only action button
   - `IconButton` — icon-only action button
   - `LabelValue` — read-only label + value pair
   - `SubLabel` — de-emphasised label text
   - `BookingStatusPill` / `InvoiceStatusPill` / `StatusPill` — status badges
3. **Only write raw `className`** if no existing component covers the pattern (and the issue agrees). **Never replicate a component's styling** with raw Tailwind — use the component.

### Creating new shared components
Creating a new file in `components/common/` or `components/ui/` requires approval — flag it in the issue at planning time, or stop and ask if it emerges mid-build. Explain what the new component does and why no existing component covers the case. Do not proceed without confirmation.

### Story requirement
A new page or component is not done until it has a `.stories.tsx` (presence is enforced by a CI scan — a component without a story fails CI). Story *tasks* are written into UI issues explicitly and sequenced **before** the component build, so the story is a review checkpoint (see `docs/agents/issue-authoring.md` and ADR-0023). Story *quality* follows the ADR-0024 tiers below.

### Story testing tiers (see ADR-0024)
- `components/ui/` — smoke: story renders, key elements visible
- `components/common/` — smoke + one `play` function covering the primary use case
- Feature presentational components — interaction `play` covering the primary happy path
- Page stories — smoke only

### Development sequence
For feature components, always build the presentational layer + story before the container (per ADR-0023). This ensures every new UI is reviewable in Storybook before logic is wired up.

## Session Behaviour
- Build only what the current session specifies. Do not begin the next feature unprompted.
- Do not run database migrations without confirming first.

### Session-stop (the unit that matters is the session, not the PR)
The feature branch persists across sessions; my context does not. "Too big" means *my context degrading and me ploughing on anyway* — never let that happen. The fix is to bound the **session**, biased hard toward stopping.

**After every sub-issue commit, checkpoint. Default action: STOP and hand off.** Continue to another sub-issue only if *all* of these hold:
- the next sub-issue is small, **and**
- I show no degradation symptoms (re-reading files I already read this session, re-asking decisions we already settled, losing the thread of the plan), **and**
- I have done ≤1 sub-issue so far this session.

**Stopping cleanly is the success condition — not a partial failure.** Never push through a degrading context to "finish the tracking issue." The tracking issue is a durable map advanced one increment at a time, not a goal to complete in one sitting.

**AFK loop mode (ADR-0040):** this stop-and-hand-off rule governs *interactive* sessions. When work runs under the cold agent loop (`afk-ralph.sh`), the **cold-process restart between iterations IS the handoff** — a fresh, empty-context process resumes from `progress.md` + git + `gh`. The no-degrading-context principle is unchanged; AFK mode satisfies it by restarting the process instead of stopping for a human. A slice the loop cannot complete cleanly is flagged `ready-for-human` rather than pushed through.

**At a stop:** leave the branch at a clean commit → tick the completed sub-issues on the tracking issue → post a short handoff comment on the tracking issue (what's done, the next unblocked sub-issue, any decisions not yet in docs; `/handoff` can draft it) → summarise to the human. Next session resumes from the tracking issue + branch log.

### End-of-session summary
- What was built
- Any decisions made that weren't in the spec
- Anything to review before the next session
- **Promotion candidates:** repeated `className`/JSX patterns that may warrant extraction to `components/common/`

## Data Fetching
- Use TanStack Query (`useQuery`, `useMutation`) for all data fetching. Never fetch in raw `useEffect`.
- Always gate queries with `enabled: isLoaded` (from Clerk's `useAuth()`) to avoid race conditions on page refresh where Clerk hasn't initialised yet.
- `queryFn` calls use `apiGet`/`apiPost`/etc. from `src/lib/api.ts`.
- Query keys are arrays: `['bookings']`, `['bookings', filter]`, `['contact', id]`, etc.
- Filter / sort state lives in URL search params (`useSearchParams`); components read the param and pass it into the query key so TanStack Query refetches when the filter changes.
- React Router loaders are used only for auth checks / redirects — not for data fetching.

## Mobile-first UI

GigMan is used on phones. Design every screen for 375px first, then enhance for larger widths.

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
- Empty states get an icon, a heading, one paragraph, and one CTA. Nothing else.
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

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Issue authoring (planning gate)

Non-trivial features are planned into issues before any code. `/to-issues` and `/grill-with-docs` are generic global skills; the GigMan-specific requirements their output must meet live in `docs/agents/issue-authoring.md`. **When authoring issues for this repo, conform to that spec and get the human's approval before coding.**

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.

### CodeScene — navigator, not gatekeeper

CodeScene MCP Server is active (default project: gigman). It is an **advisory navigator**, not a blocking gate. Target: **no meaningful regression** (not 10.0). See ADR-0026 (amended) and the Code Quality section above.

**Navigator (proactive — this is CodeScene's main value):**
- `list_technical_debt_hotspots_for_project` — ranked refactor targets. Surface these and propose refactoring as its **own deliberate work**; never force a refactor into a feature commit.
- `/codescene:prioritizing-technical-debt` — choosing what to refactor next.
- `/codescene:guiding-refactoring-with-code-health` — step-by-step refactoring workflow.

**At PR only (report, don't loop):**
- `analyze_change_set` — run once at PR; **report the Code Health delta to the human.** A regression is a conversation, not an automatic refactor loop. It also feeds `/simplify` (run `/simplify` on the files it flags + any 300-line crossers).

**Removed:** there is no per-file `code_health_review` pre-flight and no per-commit `pre_commit_code_health_safeguard`. `code_health_review` remains available on demand when deliberately inspecting a hotspot.
