# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GigLoop — a CRM for musicians. Greenfield monorepo. The living sources of truth are this file (**CLAUDE.md** — hard rules + working conventions) and **CONTEXT.md** (the domain model: booking lifecycle, entities, design principles). `SPEC.md` is a historical, pre-MVP reference only — where it disagrees with CLAUDE.md or CONTEXT.md, they win (its booking lifecycle and several entity fields have drifted from current reality). For where the product is heading next, see `docs/north-star.md` — the directional (non-binding) statement of the Wave 2 (P2) feature direction.

## Commands

Not guessable from `package.json` — run a single API test file:

```bash
bun --filter @gigloop/api run test -- --testPathPattern=<file>
```

## Hard Rules (never violate)

- **Auth:** Use Clerk exclusively. Never implement custom auth.
- **Prisma models:** Every model must include `id` (UUID), `userId` (String), `createdAt`, `updatedAt`.
- **Multi-tenancy:** Every API endpoint extracts `userId` from the Clerk JWT via a global `AuthGuard`. All DB queries are scoped to that `userId`. No endpoint may return cross-tenant data.
- **Primary keys:** UUIDs everywhere. Never auto-increment integers.
- File uploads go to Cloudflare R2 — never write to the local filesystem
- **Portal routes:** `/booking/:token` validates the booking's `portalToken` — these routes bypass Clerk auth entirely.
- **Communication templates:** Stored as Tiptap JSON; rendered to HTML with variable substitution at send time.
- **Contact deletion:** Blocked at API level if the contact has associated Bookings; return a clear error (409 response).
- **Secrets never enter the session.** Never fetch or print a live credential — DB connection string, API key, token, password — into the conversation. This includes tool-call arguments and tool *results*: calling something like Neon's `get_connection_string` surfaces the password in the transcript just as pasting it does. A connection string **is** a secret (it embeds the role password), and on Neon a role/password is shared across every branch of a project by inheritance, so one leaked string = project-wide exposure. To wire a secret into a gitignored config (`.env`, `e2e/.env`), have the **human** copy it from the source console — do not route the value through the assistant. Non-secret operations (creating a Neon branch, which returns only an id) are fine. *(This rule exists because a `neondb_owner` connection string was once pasted into a session, forcing a password rotation — see issue #675.)*

## Architecture Notes

PDF generation runs in the API process (`pdfmake`) and the result is streamed directly to the client — never generate PDFs in the frontend.

## Before Every Session
- Read CONTEXT.md before writing any code
- Confirm you understand the hard rules below before proceeding
- If anything in the task contradicts CONTEXT.md or the Hard Rules, flag it
  rather than resolving it yourself

## Code Quality

Governing principle: **deterministic checks belong to automation; judgement belongs to planning; advisory tools inform, they don't trap.** See ADR-0030. Do not hand-run deterministic checks "to be safe" — that is the duplication that caused multiple passes. Trust the automation below.

### Deterministic gates (automated — do not run by hand)

```
commit (hook):  lint + shortcut-detector      (lint: changed workspace)  — fast, blocking
push   (hook):  test + build                  (changed workspace)        — build subsumes typecheck
CI (→ main):    lint + test + build           (both apps)                — required gate
                integration                                              — informational only (continue-on-error)
```

There is **no pre-flight check and no pre-commit checklist.** Lint runs automatically at commit; test + build run automatically at push; CI re-runs everything. You never need to invoke these manually — if a hook fails, fix the cause and let the hook re-run.

> ℹ️ **Reality note (ADR-0040):** hooks live under `.githooks/` (committed). One-time opt-in required: `git config core.hooksPath .githooks`. Without it, hooks don't run and CI is the only gate. The **shortcut-detector** (`scripts/shortcut-detector.mjs`, wired into the pre-commit hook) is **active**: it scans the staged diff and blocks any commit that introduces a lowered-bar pattern — an `eslint-disable`, an `any` to dodge a type error, weakened or removed test assertions, or a new bare-id Prisma mutation in a `*.repository.ts` (a `where` on the primary key `id` without `userId` — the cross-tenant-write gap of ADR-0061; add `// scoped-upstream: <reason>` when a preceding scoped read already proved ownership) — so surface the trade-off instead. Note it runs *inside* the hook, so it cannot stop a `--no-verify` bypass (that skips hooks entirely); CI re-running lint/test/build is the backstop there.

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

## Code Conventions
- TypeScript strict mode in both apps
- NestJS: one module per feature (contacts, bookings, songs, etc.)
- All API responses use a consistent shape — ask before deviating
- No any types without a comment explaining why
- Errors are handled at the controller level using NestJS 
  built-in HttpException classes
- Domain types and DTOs are kept separate
- **Shared constants:** Label maps and lookup constants (status labels, category labels, ordered enum lists) belong in `apps/web/src/lib/constants.ts`. Never define a label map inside a component or page file if it may be needed elsewhere. Never import shared values from a page file — move them to `lib/constants` first.
- **One declaration per vocabulary:** a domain vocabulary (booking status, event type, reminder concern…) is declared **exactly once**, as an ordered `as const satisfies` array of records — one row per member, one column per attribute (label, description, colour tokens, flags) — guarded by a compile-time coverage check so a new member cannot be half-added. Every ordered list, `Record<Enum, …>` map and option array is **derived** from that table, never hand-written alongside it. A second hand-written list of the same members is the bug, even when it currently matches: booking status was once declared 13 times and one copy silently lost `PROVISIONAL`. Colour/class columns hold **literal** Tailwind strings (`bg-status-enquiry`) — never `` `bg-status-${slug}` ``, which the Tailwind scanner cannot see and will purge. Tests assert the table's **shape** (columns present, token pattern, key counts, order), never restate its values — a value spec is just one more declaration to drift.

### Conventions that load with the API
API conventions (DTO/OpenAPI decorators, validation, the controller/service/repository layers)
live in `apps/api/CLAUDE.md` — loaded when working under `apps/api`.

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
- Work **one feature branch at a time.** Do not open parallel sibling branches for a single feature — sub-issues are commits, not branches. (Parallel sessions on *independent* issues are allowed — governed by `docs/agents/fleet.md`.)
- **Concurrent sessions claim before coding:** swap the issue to `in-progress` (+ assignee + branch/worktree comment) and verify its declared Surfaces are disjoint from every other `in-progress` claim, respecting the WIP cap and the one-schema-PR lock. Full protocol: `docs/agents/fleet.md`.
- **Dispatch shorthand:** a session opened with just an issue reference (e.g. `691`), or started in an auto-created worktree (`claude --worktree`, which lands on a random `worktree-*` branch), is a fleet dispatch — invoke the **`fleet-claim`** skill. It normalises the branch to the naming convention, runs the claimability precheck (surface disjointness, WIP cap, schema lock), posts the claim, then builds from the agent brief.
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

## Environments, Release & Migrations

**The model is described in one place: `docs/environments.md`** — environments, databases, deploy paths, migration mechanisms, flags, and where to look when something breaks. The reasoning is **ADR-0075** (the model) and **ADR-0044** (why prod and preprod are split, rehearsal, expand/contract, rollback). Do not restate the model elsewhere; link to it.

The rules a session must obey:

- **A merge to `main` deploys to preprod, NOT prod.** Preprod is prod-shaped but runs on **synthetic data** (its own Clerk dev instance, its own R2 buckets, sunk email, seeded Neon DB). Never assume merging ships to real users.
- **Prod deploys ONLY when a human runs the "Promote to prod" workflow.** Tagging is a **deliberate human action** — I never cut a release tag myself, nor trigger that workflow. Merging a PR is where my responsibility ends.
- **Never run a database migration without confirming first** (see Session Behaviour). The rollback target for a bad prod migration is the `pre-release-<tag>` Neon branch, not PITR — the 6h window is too short.
- **Destructive / narrowing schema changes MUST use expand/contract:** dropping a column, renaming, narrowing a type, or adding `NOT NULL`/unique to existing data → add the new shape → deploy → backfill → drop the old shape only in a *later* release. Additive changes (nullable column, new table, new index) ship in one step. The app and the DB never cut over atomically, so during a deploy window the running app must tolerate **both** schemas.
- **A multi-week feature does not get a long-lived branch** (ADR-0025 forbids it). It merges to `main` continuously behind a **feature flag** and ships dark. Flags are **environment variables, default-off** — `apps/web/src/lib/featureFlags.ts` and `apps/api/src/common/featureFlags.ts` (`isEnabled('FLAG')`). No flags table, no per-user targeting.
- **Capture every new per-environment variable in `apps/api/.env.example`.**
- **Before tagging**, the human runs `docs/smoke-test-checklist.md` against preprod, and — for a release carrying schema changes — the on-demand `migration-rehearsal.yml` workflow.

## Package Discipline
- Do not install new packages without asking first
- Do not add packages to solve problems that can be solved with what's already installed
- Use `bun add <package>` (never `npm install`) for all package installation

## UI Components

### Inventory pass — happens at issue authoring, not at coding time

The "which existing component do I use?" decision is made **when the issue is written**, not while coding (per `docs/agents/issue-authoring.md`). UI issues name the components to reuse so the human can catch a missed component at planning. At coding time, **build what the issue specifies.**

The inventory for that planning-time pass is `apps/web/src/components/ui/` (primitives) and `apps/web/src/components/common/` (patterns) — read the directories rather than a list here, which drifts.

**Only write raw `className`** if no existing component covers the pattern (and the issue agrees). **Never replicate a component's styling** with raw Tailwind — use the component.

### Creating new shared components
Creating a new file in `components/common/` or `components/ui/` requires approval — flag it in the issue at planning time, or stop and ask if it emerges mid-build. Explain what the new component does and why no existing component covers the case. Do not proceed without confirmation.

### Conventions that load with the frontend
UI conventions (mobile-first layout, UI rules, loading/feedback tiers, data fetching, story tiers)
live in `apps/web/CLAUDE.md` — loaded when working under `apps/web`.

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

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Issue authoring (planning gate)

Non-trivial features are planned into issues before any code. `/to-issues` and `/grill-with-docs` are generic global skills; the GigLoop-specific requirements their output must meet live in `docs/agents/issue-authoring.md`. **When authoring issues for this repo, conform to that spec and get the human's approval before coding.**

### Strategic shaping (North Star)

`docs/north-star.md` holds the agreed **directional** roadmap for the next wave (consulted at the planning gate for "plumb-it-forward" decisions). To add or deepen a pillar, use the `/shape-north-star` skill — breadth-first direction-setting that parks architectural choices as open questions. It is the complement to `/grill-with-docs`, which converts those parked questions into binding ADRs. Shaping opens the question; grilling closes it.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix, in-progress). See `docs/agents/triage-labels.md`.

### Fleet (concurrent sessions) & batch triage

Running several interactive sessions in parallel, and running `/triage` in batch over the `needs-triage` pile, are both governed by `docs/agents/fleet.md` — read it before doing either. Key rules: claim via `in-progress` before coding; surfaces must be disjoint; batch triage fans out one sub-agent per issue and may never approve schema/lifecycle/cross-feature issues itself.

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
