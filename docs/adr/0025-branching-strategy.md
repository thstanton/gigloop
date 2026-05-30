# ADR-0025 — Feature-branch workflow with squash merge to main

## Status
Accepted

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
