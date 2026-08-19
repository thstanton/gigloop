# Environments, deploys and migrations

**This is the single operational description of how GigLoop is deployed.** README, CLAUDE.md and `docs/smoke-test-checklist.md` link here rather than restating it — four independently-drifting copies is what previously produced two false documents.

The *reasoning* lives in [ADR-0075](adr/0075-one-environment-model.md) (the model) and [ADR-0044](adr/0044-preprod-and-release-process.md) (why prod and preprod are split at all, migration rehearsal, expand/contract, rollback, seeding).

> **Status markers.** ADR-0075 describes a target state, and some of it is not true yet.
> **✅ true today** · **⏳ pending, with the issue that closes it.**
> Last audited: **2026-08-19**.

---

## The environments

There are **two deployed environments**, plus local development and throwaway databases that CI creates and destroys.

| | **prod** | **preprod** |
|---|---|---|
| Who uses it | Real musicians, real data | You, before a release |
| Web | `www.gigloop.co.uk` | `preprod.gigloop.co.uk` |
| API | `valiant-respect-production-c8bb.up.railway.app/api` | `valiant-respect-staging.up.railway.app/api` (hostname is vestigial — see below) |
| Data | Real customer data | **Synthetic** — seeded, never a copy of prod |
| Clerk | Production instance | Development instance |
| R2 | `gigloop-public` / `gigloop-documents` | `gigloop-preprod-public` / `gigloop-preprod-documents` |
| Email | Real delivery | Resend sandbox sender — cannot reach a real client |
| Deploys when | A human pushes a `v*` tag | A commit lands on `main` |

**"Preprod" is the only name for that environment.** ✅ Docs, GitHub variables, GitHub Environments, the Railway environment and the Neon branch all say `preprod` (#905, completed 2026-08-19).

"Smoke test" survives only as the name of the *activity* you run there, never the place. ADR-0044's body still says "smoke-test environment" throughout — that is left as a historical record, not swept; its header note carries the supersession.

⚠️ **The preprod API hostname still contains the word `staging` — `valiant-respect-staging.up.railway.app` — and that is deliberate.** Railway kept the generated hostname when the environment was renamed (verified 2026-08-19), so nothing broke. It is left alone because the hostname is baked into `VITE_API_BASE_URL` on the Vercel preprod project; changing it would break the preprod frontend for no benefit. **Treat `valiant-respect-staging` as a vestigial label, not a second environment.**

Environment names are **not** domain vocabulary and are deliberately absent from `CONTEXT.md`, which is the product domain — bookings, invoices, contacts.

---

## Databases

Every database is Neon Postgres except local.

| Database | Neon project | Branch | Used by |
|---|---|---|---|
| **prod** | `GigLoop` · `curly-forest-25260742` | `production` | The live app |
| **prod snapshots** | same | `pre-release-v*` | Rollback targets, one per release (ADR-0044 §6) |
| **preprod** | `GigLoop PreProd` · `autumn-hill-65970446` | `preprod` | The preprod app |
| **CI throwaway** | same as preprod | `ci-integration-*`, `ci-e2e-*` | Created and destroyed per CI run |
| **local** | ✅ None — Docker `postgres:18` | — | Your laptop |

Three things worth knowing:

- **The CI throwaway branches live inside the preprod project.** ✅ The variable pointing at it is `NEON_PREPROD_PROJECT_ID` — it used to be the *unqualified* `NEON_PROJECT_ID` while prod was the *qualified* `NEON_PROD_PROJECT_ID`, which read backwards (#905).
- **Local development runs Postgres 18 in Docker**, not Neon. ✅ `docker-compose.yml` at the repo root defines it and README → "The local database" is the setup guide (#906). It used to run on a copy-on-write branch of the *prod* project, putting real customer rows on a laptop; moving it off finishes the boundary ADR-0059 started when it moved local off prod's R2 credentials.
- ✅ **Neon is two projects, and this table is the whole of it.** The prod project's `dev` branch and the idle `GigLoop Dev` project were deleted on 2026-08-19, completing ADR-0075 §1 (#906). `production` and the `pre-release-v*` rollback branches were unaffected — `dev` was a leaf.

Connection strings come in two forms and it matters which you use. `DATABASE_URL` is **pooled** (`-pooler` host, `pgbouncer=true`) and is what the app runs on. `DIRECT_URL` is **direct** and is what the Prisma CLI uses — `migrate deploy` takes a session-level advisory lock that transaction-mode pooling breaks. `schema.prisma` reads both.

Locally the distinction does not apply: there is no pooler in front of the container, so both variables hold the same plain string. Its source is `docker-compose.yml` rather than a console — but it is still a connection string, so `apps/api/.env.example` carries a placeholder like every other value in that file. The container is published on **port 5433**, for the reason `docker-compose.yml` gives.

> 🔒 A connection string embeds the role password, and on Neon a role is shared across every branch of a project. **Never** paste one into an agent session — copy it from the Neon console into the target config yourself. See CLAUDE.md → Hard Rules.

---

## How a deploy happens

**One model, both environments: a GitHub Actions workflow runs ordered steps and drives Railway and Vercel by CLI.** Git auto-deploy is off on every service, so nothing deploys except through a workflow.

| Trigger | Workflow | Sequence |
|---|---|---|
| Commit lands on `main` | `preprod.yml` ✅ | migrate → deploy API → deploy web |
| Human pushes a `v*` tag | `release.yml` ✅ | snapshot → migrate → deploy API → deploy web |

⚠️ **Railway prod and preprod are the same project and the same service — only the *environment* differs.** `RAILWAY_PROD_PROJECT_ID` and `RAILWAY_PREPROD_PROJECT_ID` hold the same id, and both `*_SERVICE` variables say `valiant-respect`. So `RAILWAY_PREPROD_ENVIRONMENT` is the **only** thing keeping a preprod deploy out of prod, and `railway up` with a wrong `--environment` exits 0 having deployed to the wrong place. The variables are qualified anyway (ADR-0075 §3): an unqualified name is how you end up editing the wrong one. Vercel is not like this — prod and preprod are separate projects, which is why `vercel deploy --prod` is safe in both workflows.

The two are deliberately the same shape. Prod's extra first step is the durable `pre-release-<tag>` Neon branch that ADR-0044 §6 makes the rollback target. Preprod takes no snapshot — it is synthetic and disposable — and does not reseed (ADR-0044 §7: seed once, evolve via migrations).

**A merge to `main` does not reach real users.** Prod ships only on a deliberate human-pushed tag.

Both paths are workflow-only, and each got there the hard way:

- ✅ **#875** — `preprod.yml` is the only path to preprod. Git auto-deploy is off on the Railway preprod environment and the Vercel preprod project, and the workflow's first run (merge of #915, 2026-08-19) was verified end to end: it migrated the `preprod` branch of `GigLoop PreProd` over the **non-pooled** host, deployed Railway `--environment preprod`, and deployed the `gigloop-preprod` Vercel project — prod was untouched. It replaced the Railway and Vercel git integration, which had no slot in which a migration could run first: on 2026-08-19, PR #867 merged a migration and every Prisma read of `Invoice` on preprod failed with P2022 until it was applied by hand. There is no `continue-on-error` in it, so a failed migration halts the run before anything deploys and the previous build keeps serving.
- ✅ Prod git auto-deploy is **off** on both Railway and Vercel (confirmed 2026-08-19), so the tag really is the only path to prod.

---

## How migrations get applied

Five mechanisms, one per database. There is no sixth, and nothing is migrated by hand.

| Database | Applied by | When |
|---|---|---|
| prod | `release.yml` | On a `v*` tag, before the API deploys |
| preprod | `preprod.yml` | On merge to `main`, before the API deploys |
| CI integration | `ci.yml` → `integration` | Per PR, against a fresh Neon branch |
| CI e2e | `ci.yml` → `e2e` | Per PR, against a fresh Neon branch |
| local | `bun run db:migrate` (`prisma migrate deploy`), or `prisma migrate dev` to author a new one | ✅ By you, against the Docker container |

Separately, **`migration-rehearsal.yml`** (manual, on demand) clones *prod* to an ephemeral Neon branch, applies pending migrations there and reports whether they applied cleanly and how long they locked. Run it before tagging a release that carries schema changes. It validates that a migration **applies**; it cannot tell you the migration is *right* — a cleanly-applying migration can still be semantically destructive. That is what expand/contract (ADR-0044 §5) and the rollback branch (§6) are for.

**Destructive changes must use expand/contract.** Adding a nullable column, a table or an index ships in one step. Dropping a column, renaming, narrowing a type, or adding `NOT NULL`/unique to existing data must add the new shape → deploy → backfill → drop the old shape in a *later* release. The app and the database never cut over atomically, so during a deploy window the running code must tolerate both schemas.

---

## Feature flags

Flags are **environment variables, default-off** (ADR-0044 §8). No flags table, no per-user targeting. Leaving a flag unset anywhere — including prod — keeps it off.

| Flag | Gates | preprod | prod |
|---|---|---|---|
| `VITE_FEATURE_COMMAND_PALETTE` | Global ⌘K command palette (#794) | on | off |

⏳ #909 — this table plus a workflow to flip a flag from the control plane.

Two helpers read them: `apps/web/src/lib/featureFlags.ts` and `apps/api/src/common/featureFlags.ts`. They are near-identical by necessity, not by accident — the web one **must** use `import.meta.env` for Vite's static replacement.

**The latency difference is surprising and worth knowing before you plan a launch:**

- **API flags** are read from `process.env` at call time → change the variable, restart the service, done in **seconds**.
- **Web flags** are `VITE_`-prefixed and statically replaced by Vite **at build time** → changing one needs a full rebuild and redeploy, so **minutes**.

If that becomes a real problem the fix is to serve flags from the API (`GET /api/flags`) rather than baking them into the bundle — still environment variables, still no flags table, so ADR-0044 §8 stands either way. Parked, not adopted (ADR-0075 §5).

> ⚠️ A `VITE_` variable in Vercel must **not** be marked *Sensitive*. Vercel withholds Sensitive plaintext from `vercel pull`, so the value bakes as `""` and the feature silently never turns on. This has broken prod twice.

---

## Environment identification

`VITE_ENVIRONMENT` is not a feature flag — it doesn't gate behaviour, it labels which deployment the UI is running in, so nobody mistakes preprod's synthetic data for the real thing. `apps/web/src/lib/environment.ts` reads it:

- **Local dev** is detected automatically via Vite's own `DEV` flag — no variable to set.
- **Preprod** sets `VITE_ENVIRONMENT=preprod` on the preprod Vercel project.
- **Prod** leaves it unset.

When set, the app prefixes the browser tab title (`[PreProd] GigLoop`) and shows a small badge next to the wordmark in the top bar. Same Sensitive-variable caveat as above applies.

---

## Where to look when something breaks

| Question | Where |
|---|---|
| What's deployed where, and did it succeed? | GitHub → [Environments](https://github.com/thstanton/gigloop/deployments) — curated to exactly `prod` and `preprod` (#907). Both `preprod.yml` and `release.yml` declare a job-level `environment:`, so every run records a deployment against it with the deployed ref (a tag for prod, e.g. `v0.6.0`) and its success/failure status. |
| Did the deploy workflow fail? | GitHub → Actions |
| Did a migration fail? | The same workflow run — a failed migration halts it before anything deploys |
| Is the app throwing errors? | ⏳ #744 — Sentry. Until then, Railway logs |
| Is preprod's data wrong? | It's synthetic and seeded — reseed by hand, it is not auto-reset |

The whole control plane is tracked by **#910**.

---

## Releasing

1. Merge to `main`. Preprod deploys.
2. Run [`docs/smoke-test-checklist.md`](smoke-test-checklist.md) against preprod.
3. If the release carries schema changes, run `migration-rehearsal.yml`.
4. Push a `v*` tag from an up-to-date `main` checkout. Prod deploys.

> ⚠️ **`git tag` with no commit argument pins `HEAD`, not `main`.** A tag cut while standing on a feature branch once shipped a tree missing five merged PRs. This repo uses true merge commits, so `git branch --contains` and `merge-base --is-ancestor` both report "on main" for a commit that sits on a merged-in side branch — they cannot catch it. The check that works is first-parent reachability: `git rev-list --first-parent origin/main | grep -q <sha>`. ⏳ #908 makes this a guarded button.

---

## Open work

| Issue | What |
|---|---|
| #908 | Promote to prod from a guarded button |
| #909 | Flags legible and flippable |
| #744 | Error alerting (Sentry) |
| #910 | Control plane — tracking issue for #907–#909 + #744 |
