# ADR-0075: One environment model — GitHub owns every deploy, each environment has one name, and one page describes it

- **Status:** Accepted
- **Date:** 2026-08-19
- **Grilled from:** #875 (nothing applies migrations to preprod), grilled 2026-08-19
- **Supersedes:** [ADR-0044](0044-preprod-and-release-process.md) **§3 and §4 only**. ADR-0044 §1 (why prod and preprod are split), §2 (migration rehearsal), §5 (expand/contract), §6 (rollback via named Neon branch), §7 (seed once, evolve via migrations) and §8 (flags are environment variables) all stand unchanged.
- **Related:** ADR-0059 (private document access — moved local dev off prod R2 credentials), ADR-0025 (trunk-based branching), #744 (error alerting), #442 (the earlier ADR whose infrastructure ACs were never executed)

## Context

The trigger was #875. ADR-0044 §4 stated that the preprod database "evolves via `migrate deploy` on deploy, exactly like prod." Nothing ever implemented that. On 2026-08-19 PR #867 merged a migration adding `Invoice.paymentReference`; the API auto-deployed to preprod carrying a Prisma client that selects the new column against a database that did not have it, and **every** Prisma read of `Invoice` on preprod began failing with P2022. It went unnoticed for six weeks because all 40 preprod migrations share a single `finished_at` — one bulk run when preprod was stood up — so `20260818120000` was the first schema change since, and the missing automation had never been exercised.

But #875 is a symptom. Grilling it surfaced the real problem: **nobody can hold the deployment model in their head.** An audit on 2026-08-19 found:

- **Three Neon projects, and the default branch of all three is named `production`** — so "the production branch" names three different databases, two of which are not production.
- **Local development ran against a copy-on-write branch of the prod project**, carrying real customer rows on a laptop, while a purpose-built `GigLoop Dev` project sat idle at 160 CPU-seconds since 5 July.
- **CI's ephemeral branches are cut inside the preprod project** under a GitHub variable named `NEON_PROJECT_ID` — the *unqualified* name means preprod, while prod is the qualified `NEON_PROD_PROJECT_ID`. A reader of `ci.yml` would reasonably guess the opposite.
- **Two deploy trigger mechanisms.** Preprod deployed by Railway and Vercel git integration — each platform independently noticing a merge, with no coordination and no slot in which anything can happen *first*. Prod deployed by an ordered GitHub workflow. So the answer to "how does a deploy happen?" depended on which environment you meant, and #875 existed precisely because the git-integration path has nowhere to hang a migration.
- **One environment with three names** — `preprod` in CLAUDE.md and the public URL, "smoke-test environment" throughout ADR-0044, `staging` in Railway. Plus a fourth in GitHub's Deployments API, which had accumulated ten auto-created environments including a `gigman-be / staging` left over from the rebrand.
- **Four partial descriptions of the model** (README, CLAUDE.md, ADR-0044, `docs/smoke-test-checklist.md`), each restating rather than referencing, **two of them false**: README claimed `ci.yml` deploys preprod (it is `pull_request`-only and has no deploy job), and ADR-0044 §4 claimed a migration mechanism that did not exist.

The common root is the same one ADR-0071 names in a different domain: **the model was asserted in prose, in several places, and enforced nowhere.** Fixing only #875 would have left every other confusion intact.

## Decision

### 1. Local development runs on Docker Postgres, not Neon

Local dev runs `postgres:18` (matching prod's major version) in a container, seeded by `prisma/seed.ts`. The `GigLoop Dev` Neon project and the `dev` branch of the prod project are both deleted. Neon drops from three projects to two: **prod** and **preprod**.

This applies ADR-0044 §1's own reasoning — which rejected cloning prod into a standing environment because "the rows carry real contact PII and emails sitting in a less-locked-down environment… a GDPR liability" — to the one place it had never been applied. ADR-0059 already moved local dev off prod's R2 credentials on identical grounds; the database was the last piece still pointing at prod.

The accepted cost is that local no longer exercises Neon-specific behaviour (pgbouncer pooling, scale-to-zero cold starts). That coverage is not lost: CI's integration and e2e jobs run against real ephemeral Neon branches on every PR.

### 2. GitHub owns the deploy sequence in every environment

There is now exactly **one** answer to "how does a deploy happen": a GitHub Actions workflow runs ordered steps and drives Railway and Vercel by CLI.

| Trigger | Workflow | Sequence |
|---|---|---|
| merge to `main` | `preprod.yml` | migrate → deploy API → deploy web |
| human pushes `v*` | `release.yml` | snapshot → migrate → deploy API → deploy web |

Git auto-deploy is **disabled on every service in both environments**. The two workflows are deliberately the same shape; prod's only additional step is the durable `pre-release-<tag>` Neon snapshot required by ADR-0044 §6. Preprod takes no snapshot — it is synthetic and disposable — and does not reseed, per ADR-0044 §7.

We rejected two alternatives that also achieve correct ordering. **Railway's `preDeployCommand`** (migrations riding inside the deploy container, before traffic swaps) is genuinely elegant and needs no new secrets at all, since the Railway service already holds `DIRECT_URL` — but a failed migration is then visible only in Railway's deploy logs, where nobody is looking. **Railway's "wait for CI"** keeps git integration and adds a migration-only workflow, but splits the ordering guarantee across a workflow file and a dashboard toggle. The workflow route was chosen because a failure produces a red ✗ on the commit in the place the team already watches, and because one model beats two even when both are correct.

The cost is real and accepted: two new repository secrets (`PREPROD_DATABASE_URL`, `RAILWAY_PREPROD_TOKEN`), several new variables, and turning off auto-deploy on two more services. `PREPROD_DATABASE_URL` must be the **direct, non-pooled** Neon string with `connect_timeout=15`, for the reasons `release.yml`'s header already documents for prod: `migrate deploy` takes a session-level advisory lock that transaction-mode pooling breaks.

### 3. Each environment has exactly one name

The environments are **`prod`** and **`preprod`**. That word is used on every surface — Railway environment, Neon branch, GitHub variable, GitHub Environment, and every document. `NEON_PROJECT_ID` becomes `NEON_PREPROD_PROJECT_ID`, so no environment is ever referred to by an unqualified name.

"Smoke test" survives only as the name of the **activity** (`docs/smoke-test-checklist.md`), never as the name of a place. "Staging" is retired entirely.

Environment names are **not** domain vocabulary and do not belong in `CONTEXT.md`, which is the product domain — bookings, invoices, contacts — and stays free of implementation detail.

### 4. GitHub is the control plane

Rather than build a bespoke ops dashboard, the pane is GitHub, because it is where CI already lives and because it already holds most of the data: Railway and Vercel have been reporting deployment records into GitHub's Deployments API all along.

- **What is deployed where** — GitHub Environments, curated down to `prod` and `preprod`, with both workflows creating deployment records.
- **Promote to prod** — a button (`workflow_dispatch`, or an approval gate on the `prod` Environment). Tagging remains a deliberate human act; a button is one.
- **Flags** — a `workflow_dispatch` workflow sets the variable and redeploys.
- **Errors and exceptions** — #744 (Sentry), already specified.

A bespoke internal dashboard was considered and rejected for now: it would need a backend holding deploy-capable tokens — a Railway token can destroy services — which is a poor trade on a solo project when GitHub delivers most of the value for none of the attack surface.

### 5. Flags remain environment variables, and the web-flag limitation is stated rather than hidden

ADR-0044 §8 stands: flags are per-environment environment variables, default-off, with no flags table and no per-user targeting.

The limitation this exposes must be documented rather than discovered. **API flags** are read from `process.env` at call time, so a variable change plus a restart takes seconds. **Web flags** are `VITE_`-prefixed and statically replaced by Vite at build time, so changing one requires a full rebuild and redeploy — minutes, not seconds.

If web-flag latency becomes a real problem, the fix is to serve flags from the API (`GET /api/flags` reading `process.env`) rather than baking them into the bundle. That would keep flags as environment variables, per-environment, with no flags table — so it does **not** require reopening §8, which legislates what a flag *is*, not how the web app learns its value. It is parked, not adopted.

### 6. One page describes the model

`docs/environments.md` is the single operational description of environments, databases, deploy paths, migration paths and flags. Everything else **links** to it rather than restating it: README, CLAUDE.md, `docs/smoke-test-checklist.md`, and this ADR.

The division is: **documents say what is true; ADRs say why it was chosen.** Four independently-drifting copies is what produced two false documents, and no amount of care prevents that recurring while four copies exist.

## Consequences

- **Preprod stops being able to run against an un-migrated database.** The failure mode of #875 becomes impossible by construction: the deploy cannot start until the migration succeeds.
- **A failed preprod migration halts the deploy and leaves the old code serving**, which is the correct failure. No `continue-on-error`, matching `release.yml`'s deliberate choice.
- **The migration inventory becomes legible.** Every database is migrated by exactly one named mechanism: prod by `release.yml`, preprod by `preprod.yml`, CI's ephemeral branches by their own jobs, a prod clone by `migration-rehearsal.yml`, and local by `migrate dev` against Docker. `docs/environments.md` lists all five.
- **This ADR describes a target state.** Several parts are not true on the day it is accepted; `docs/environments.md` marks each line as already-true or pending, with the issue that closes it. An ADR describing an aspiration is only honest if the gap is visible.
- **The rename touches dashboards and `ci.yml` together.** `NEON_PROJECT_ID` → `NEON_PREPROD_PROJECT_ID` must land in the same commit as the workflow edit that reads it, or CI's integration and e2e jobs break on the next PR.
- **Two more services lose git auto-deploy**, so a merge no longer deploys anything by itself. If `preprod.yml` is broken or disabled, preprod silently stops updating — the failure mode swaps from "deploys the wrong thing" to "deploys nothing." The deployment records in GitHub Environments are what make that visible.
- **ADR-0044 remains the reference for why prod and preprod are split at all**, for migration rehearsal, expand/contract, rollback and seeding. This ADR replaces only how deploys are triggered and what things are called.
