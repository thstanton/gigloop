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

These rules apply every session — not just when things look complex.

**Pre-flight:** Before modifying any existing file:
1. Run `bun run lint` on it and report any existing violations
2. Run CodeScene `code_health_review` on it and report any health issues

If the file has complexity errors or Code Health problems, propose refactoring it first before adding new code.

**Pre-commit:** Before every commit:
1. Run `bun run lint && bun run build` in both `apps/api` and `apps/web` — never commit if either fails
2. Run CodeScene `pre_commit_code_health_safeguard` — if it reports a regression, refactor before committing

**Pre-PR (mandatory — in this order):**
1. `bun run lint && bun run build` in both workspaces — must pass clean
2. Run CodeScene `analyze_change_set` — if it reports a regression, refactor before opening PR
3. Run `/simplify` on every file substantially changed in the session
4. Confirm every new page or component file has a `.stories.tsx` in the same branch
5. Open PR with `gh pr create`

**Line count proxy:** Files over ~300 lines are a yellow flag. Check lint complexity before extending them further.

**ESLint disables:** Never add an `eslint-disable` comment without explaining the situation and getting explicit permission. The only pre-approved suppress is `@typescript-eslint/no-explicit-any` (with a mandatory inline comment explaining why). All other suppressions — including `react-hooks/exhaustive-deps` — require approval. If a lint rule cannot be resolved cleanly, stop and explain the situation rather than silencing it.

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

### Branch naming
- `feature/<issue-number>-short-description` — new functionality (references tracking issue number)
- `fix/<issue-number>-short-description` — bug fixes
- `chore/<short-description>` — tooling, dependencies, config (no issue number required)
- `docs/<short-description>` — documentation and process file updates (`CLAUDE.md`, `CONTEXT.md`, `docs/adr/`, `SPEC.md`)

### Multi-issue features
For features spanning several issues, create a **tracking issue** in GitHub Issues — an umbrella issue whose body lists sub-issues as a task list (`- [ ] #94 description`). The branch references the tracking issue number. Sub-issues are closed via `Closes #94, #95` in the PR description.

### Commit messages
Use [Conventional Commits](https://www.conventionalcommits.org/):
`<type>[optional scope]: <description>`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`

Examples: `feat(bookings): add checklist seeding on creation`, `fix(invoices): correct deposit tracking on send`, `ci: cache node_modules in GitHub Actions`

### One commit per issue — mandatory
**Each issue must be its own commit.** Never batch multiple issues into a single commit.

- Complete one issue fully (code + tests + story passing), commit it, then move to the next.
- The commit message body must include `Closes #<issue-number>` so the issue is closed automatically on merge.
- If issues have a strict dependency order, complete and commit them in that order.
- If issues are independent, commit each in whichever order you work through them — but still one commit per issue.
- **Stories are part of the issue commit** — a new page or component commit is not complete without its `.stories.tsx` file. `chore(storybook):` commits are only for updating existing stories, never for adding a story that should have shipped with the original feature.

This makes the git history meaningful (each commit is a reviewable unit of work), keeps CI bisectable, and ensures individual issues can be reverted cleanly if needed.

### My responsibilities (Claude Code)
- At the start of any session involving application code changes: confirm we are on a feature branch, or create one.
- When working multiple branches in one session: open a PR for each branch as soon as it is complete, then immediately start the next branch. This lets review overlap with ongoing development.
- At the end of the session: run the Pre-PR checklist above, then open a PR with `gh pr create`.
- Never push application code directly to `main`.

### Merging
- Squash merge only (configured in GitHub repo settings — disable merge commits and rebase merge).
- PRs require CI to pass (Lint, Test, Build — see `.github/workflows/ci.yml`) before merging.
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

### Inventory check — mandatory before writing any JSX

Before writing any JSX, work through these steps in order:

1. **Check `components/ui/`** for primitives: `Button` (default/outline/ghost/destructive variants), `Input`, `Textarea`, `Select`, `Switch`, `Label`, `Badge`, `Separator`, `Sheet`, `Dialog`, `Tabs`, `Tooltip`, `Toast`
2. **Check `components/common/`** for patterns:
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
3. **Only write raw `className`** if no existing component covers the pattern. If unsure, ask.
4. **Never replicate a component's styling** with raw Tailwind — use the component.

### Creating new shared components
Creating a new file in `components/common/` or `components/ui/` requires approval. Before creating one, stop and ask — explaining what the new component does and why no existing component covers the case. Do not proceed without confirmation.

### Story requirement
A `components/common/` component is not done until it has at least one story covering its primary use case. Stories are the usage documentation that makes the inventory check above reliable — a component without a story is invisible to the next session.

### Story testing tiers (see ADR-0024)
- `components/ui/` — smoke: story renders, key elements visible
- `components/common/` — smoke + one `play` function covering the primary use case
- Feature presentational components — interaction `play` covering the primary happy path
- Page stories — smoke only

### Development sequence
For feature components, always build the presentational layer + story before the container (per ADR-0023). This ensures every new UI is reviewable in Storybook before logic is wired up.

## Session Behaviour
- Build only what the current session specifies
- Do not begin the next feature unprompted
- **Session sizing:** For UI-heavy features, work a maximum of 3–4 issues per session. When a feature has a dependency chain (API → layout → individual pages), break it into sessions by dependency level rather than attempting all layers at once.
- When the session task is complete, stop and summarise:
  - What was built
  - Any decisions made that weren't in the spec
  - Anything that should be reviewed before the next session
  - **Promotion candidates:** any repeated `className`/JSX patterns observed that may warrant extraction to `components/common/`
- Do not run database migrations without confirming first
- Commit after each issue is complete — not once at the end of the session (see **One commit per issue** under Branching Strategy)

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

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.

### CodeScene

CodeScene MCP Server is active (default project: gigman). Target Code Health: 10.0.

**Mandatory safeguards (every session):**
- `pre_commit_code_health_safeguard` — before every commit (staged files gate)
- `analyze_change_set` — before every PR (branch-level gate)
- If either reports a regression: run `code_health_review` on flagged files, refactor, re-check. Do not declare work done with a failing safeguard.

**File inspection:**
- `code_health_review` — detailed review of a file; use during pre-flight on any file flagged as a hotspot
- `/codescene:guiding-refactoring-with-code-health` — step-by-step refactoring workflow using Code Health findings

**Prioritization:**
- `/codescene:prioritizing-technical-debt` — use when choosing what to refactor next
- `list_technical_debt_hotspots_for_project` — ranked list of highest-risk files
