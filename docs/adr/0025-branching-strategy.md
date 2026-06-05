# ADR-0025 — Feature-branch workflow with squash merge to main

## Status
Accepted  
**Amended:** 2026-06-01 — "one branch per feature" made explicit and enforced; the "open a PR per branch, immediately start the next" guidance is withdrawn. See "Amendment 2026-06-01" below and ADR-0030.  
**Amended:** 2026-06-05 — Persistent `release` branch introduced as a staging gate. Integration tests moved to `release → main` PRs only. See "Amendment 2026-06-05" below.

## Amendment (2026-06-05): two-tier branch model with `release` gate

Integration tests take ~5 minutes per run. Running them on every feature PR makes CI too slow for a tight feedback loop. A persistent `release` branch now sits between `feature/*` and `main`:

- **`feature/*` → `release` PR:** Lint, Test, Build required. Integration skipped.
- **`release` → `main` PR:** Lint, Test, Build, and Integration all required.

`release` always reflects the set of features queued for production. `main` is the production-ready state. Feature branches target `release`; the `release → main` PR is opened when a batch of features is ready to ship.

**Branch protection:**

| Branch | Required checks |
|--------|----------------|
| `release` | Lint, Test, Build |
| `main` | Lint, Test, Build, Integration |

**CI behaviour:** The `integration` job in `ci.yml` runs conditionally — only when the PR targets `main` or on a push to `main`. On `release` PRs it is skipped (GitHub marks it "skipped", not "passing"), so branch protection on `main` correctly blocks until it actually runs.

**Exception — doc-only changes:** `CLAUDE.md`, `CONTEXT.md`, `docs/adr/`, `SPEC.md` may still be committed directly to `main` per the original exception.

## Amendment (2026-06-01): one branch per feature, never parallel siblings

The original decision already chose one branch per feature (rejecting one-branch-per-sub-issue), but practice drifted: the BookingSeries feature (#146) was split into four *dependent* sibling branches (#147 schema → #148 module → #149 prepopulation → #150 retroactive), each its own PR. Under squash merge, dependent sibling branches are a conflict footgun — each downstream branch had to absorb the *squashed* version of its upstream sibling, producing duplicate-looking history, `Merge branch 'main'` commits, and explicit `fix conflicts` commits. A contributing cause was *horizontal* slicing (a "schema migration" issue is a layer, not a shippable capability), which manufactured the dependency chain.

Enforced going forward:
- **One feature = one branch = one PR.** Sub-issues are *commits* on that branch, closed via the PR description. CI runs once; the feature is reviewed as a coherent unit.
- **No sibling branches for a dependent feature.** If a feature is too big for one reviewable PR, split into **sequential** tracking issues — branch → PR → merge before the next starts. Never parallel.
- The "when working multiple branches in one session, open a PR for each as soon as complete and start the next" guidance is **withdrawn** — it encouraged the parallel siblings that caused the conflicts.
- Issues are sliced **vertically** (thin end-to-end capability), not by layer. See `docs/agents/issue-authoring.md`.

The feature branch is expected to span multiple sessions; this is normal and is what the persistent branch is for (see ADR-0030, session-stop).

## Context

The project pushed directly to `main` through early development. As the codebase matures and production deployment to Vercel (frontend) and Railway (backend) approaches, a broken `main` becomes immediately user-facing. A lightweight, enforced workflow is needed that catches regressions before they land on `main` without adding team-scale ceremony to a solo project.

## Decision

**Branch model:** short-lived feature branches merged to `main` via PR. No persistent `develop` branch (gitflow overhead not warranted solo). No trunk-based development (requires feature flags and near-hourly merges).

**Branch naming:**
- `feature/<tracking-issue-number>-description` for new functionality
- `fix/<issue-number>-description` for bug fixes
- `chore/description` for tooling/config (no issue number required)

**Multi-issue features:** grouped via a GitHub tracking issue (umbrella issue with a task list of sub-issues). The branch references the tracking issue number; sub-issues are closed in the PR description via `Closes #N`.

**CI:** three required checks on every PR via GitHub Actions — Lint, Test, Build. Tests are fully mocked (no live DB needed). All three must pass before merge is allowed.

**Merge strategy:** squash merge only. All branch commits collapse into one commit on `main`, keeping `main` history readable as a changelog. Merge commits and rebase merge are disabled in GitHub repo settings.

**Lifecycle ownership:** Claude Code creates feature branches and opens PRs; the user is the only one who merges.

**Exception:** root-level docs and process files (`CLAUDE.md`, `CONTEXT.md`, `docs/adr/`, `SPEC.md`) may be committed directly to `main` — they contain no deployable code and wrapping every glossary update in a PR would be friction with no safety benefit.

## Alternatives considered

- **Gitflow (main + develop):** Rejected — adds a persistent `develop` branch and a formal release step. Designed for teams with scheduled releases; unnecessary overhead for a solo project.
- **Trunk-based development:** Rejected — requires feature flags for incomplete work and near-continuous merges. Better suited to larger teams; not practical here.
- **Merge commits:** Rejected — branches accumulate "fix lint", "tweak spacing" commits that are meaningless individually. Squash gives `main` one clean commit per feature and makes the log readable.
- **One branch per sub-issue:** Rejected for features — splitting 6–7 tightly coupled sub-issues into 6–7 separate PRs creates more overhead than benefit for a solo project. The tracking issue provides the granularity; the branch is the unit of deployment.

## Consequences

- `main` is always in a deployable state once CI is wired to branch protection.
- Every code change has a PR, a CI run, and a squash commit — full audit trail.
- Claude Code never pushes application code directly to `main`.
