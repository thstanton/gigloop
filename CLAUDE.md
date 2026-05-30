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

## Repository Pattern
Every feature module uses three layers:
- **Controller** (`*.controller.ts`) — request/response handling only; no business logic, no Prisma calls
- **Service** (`*.service.ts`) — business logic and orchestration only; no input validation (that belongs in DTOs)
- **Repository** (`*.repository.ts`) — all direct Prisma calls; no business logic

The service depends on the repository; the controller depends on the service.
All three are declared as providers in the feature module.

## Package Discipline
- Do not install new packages without asking first
- Do not add packages to solve problems that can be solved with what's already installed
- Use `bun add <package>` (never `npm install`) for all package installation

## UI Components

### Inventory check — before writing any UI code
Before writing any JSX, scan `components/common/` and `components/ui/`. If a component already encodes the pattern you need (typography, spacing + colour combination, layout), use it. Writing raw `className` that replicates what an existing component already does is the mistake to prevent — not just creating new files.

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
- When the session task is complete, stop and summarise:
  - What was built
  - Any decisions made that weren't in the spec
  - Anything that should be reviewed before the next session
  - **Promotion candidates:** any repeated `className`/JSX patterns observed that may warrant extraction to `components/common/`
- Do not run database migrations without confirming first
- Run `bun run test` and verify all tests pass before committing
- Commit all changes at the end of each session with a descriptive message

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
