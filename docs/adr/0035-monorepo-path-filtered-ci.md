# ADR-0035 — Monorepo with path-filtered CI over split repos

## Status
Accepted

## Context

Both apps live in a single monorepo (`apps/api`, `apps/web`). As the project grew, every PR ran lint, test, and build for both apps regardless of what changed, and every merge to main triggered a redeployment of both Vercel (frontend) and Railway (API). This created unnecessary CI time and spurious deployment noise.

The question was whether to split into two repos or fix the triggers in place.

## Decision

Stay monorepo. Add a `detect-changes` job (using `dorny/paths-filter`) that runs first on every PR and outputs which app directories were touched. The `Lint`, `Test`, and `Build` jobs always run (preserving branch protection check names), but steps within each job execute conditionally based on the filter output. The `Integration` job has a job-level `if:` condition since it is not a required check.

Deployment platforms are configured to watch only their relevant directory: Vercel uses the "Ignored Build Step" setting with `git diff HEAD^ HEAD --quiet -- ./apps/web` (exits 0 = skip, exits 1 = build); Railway watches `apps/api/**` only.

## Consequences

- A frontend-only PR skips all API lint/test/build steps and never triggers a Railway deploy.
- An API-only PR skips all web lint/test/build steps and never triggers a Vercel deploy.
- Docs-only PRs (ADRs, CONTEXT.md) run the install step and pass empty — no work is skipped by suppressing the check entirely, since branch protection requires the check name to be present.
- `.github/workflows/**` changes are in both filters so CI file edits always run the full suite.

## Alternatives considered

- **Split repos (`gigman-web` + `gigman-api`):** Rejected. Cross-cutting changes (API DTO added → `apps/web/src/types/api.ts` mirrored) happen on almost every feature. Two repos would turn these into coordinated multi-PR sequences, adding friction that outweighs any CI cleanliness gain. The monorepo also gives the AI agent visibility of both sides simultaneously, which is the primary workflow.
- **Turborepo / Nx:** Rejected as over-engineering for a solo project. Path filtering achieves the same selective execution without a build orchestration layer.
