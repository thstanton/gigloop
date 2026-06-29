# ADR-0044 — Preprod Environment and Release Process

## Status

Accepted

## Context

Until now GigMan has had exactly one of everything: one Railway API service, one Vercel web deployment, one Neon database. There is no production data — the database has only been carrying development and test data, so migrations and deploys have hit "prod" directly with no rehearsal and no real downside to getting one wrong.

That changes the moment the MVP is finalised (immediately after the invoice Issued-state rework, ADR-0042) and real users start entering real data. From that point:

- A bad migration can corrupt or lose **real customer data** — contacts, bookings, invoices that someone depends on. There is no longer a free "just reset the DB."
- A broken deploy is visible to real users.
- Wave-2 features are roadmapped that will take weeks to build and must be tested end-to-end before going live — they cannot sit half-finished blocking every prod release, and they must not reintroduce long-lived feature branches (ADR-0025 forbids them; they corrupted the series feature).

We need a way to rehearse migrations against prod-shaped data, smoke-test a release before users see it, hold prod back behind a deliberate human action, recover if a migration still goes wrong, and dark-launch long-running features — all without violating the single-trunk model in ADR-0025.

## Decision

### 1. Two jobs, deliberately split — not one blended "preprod"

The naive design is a single persistent preprod that clones prod. We rejected it. Cloning prod data into a standing environment drags every prod-only external reference along with it: cloned `userId`s are **prod Clerk IDs** (so a separate Clerk instance scopes the `AuthGuard` to a different user and shows an empty app — cloning effectively *forces* sharing the prod Clerk instance), cloned `Document` rows hold **prod R2 keys** (a separate bucket 404s every file), and the rows carry **real contact PII and emails** sitting in a less-locked-down environment. A blend optimises for nothing and is a GDPR liability.

Instead we split the two needs, because they want opposite data strategies:

- **Migration rehearsal wants real prod data and barely needs the app deployed.** It is an on-demand, ephemeral step, not a standing environment.
- **Release smoke-test wants the deployed stack and is far cleaner with synthetic data** — its own Clerk, its own bucket, fake emails, zero referential collisions, zero PII.

### 2. Migration rehearsal — ephemeral Neon branch off prod

Before a release is tagged, an on-demand job (the same pattern the integration CI already uses): create a Neon branch off **prod** (instant copy-on-write clone with real current data) → `prisma migrate deploy` against it → report applied-clean / failed and how long it locked → **delete the branch**.

This answers "does this exact migration apply to *real* data, and how long does it lock?" with prod never at risk. Its scope is explicit and limited: it catches a migration that **fails to apply, locks too long, or the app won't boot against the new schema**. It does **not** catch a migration that applies cleanly but is *semantically destructive* (drops a still-needed column, a backfill that mangles data). That class is handled by §5 (expand/contract) and §6 (rollback), not by rehearsal.

### 3. Smoke-test environment — persistent, deployed, synthetic

A persistent, prod-like stack that auto-deploys from `main` on every merge:

- **Web:** a Vercel preprod deployment. **API:** a Railway `staging` environment.
- **API base URL must be cut from the trunk.** Today `apps/web/vercel.json` statically rewrites `/api/:path*` → the **prod** Railway URL, and both envs auto-deploy from the same `main`. As-is, a Vercel preprod build of `main` would route the smoke-test frontend straight at the **prod API** — reading and writing prod through the "synthetic" stack and silently defeating the entire split. The API base is one more prod-only reference baked into the shared trunk and must be cut like Clerk/R2/email were. Fix: drive the API base from a build-time env var per Vercel environment (`VITE_API_BASE_URL` resolved in `api.ts`), or give preprod a **separate Vercel project** with its own `vercel.json`. The static prod rewrite must not survive into the preprod deployment. (Implementation choice deferred to the issue; the *constraint* is non-negotiable.)
- **DB:** its own small Neon database that is **synthetic by construction** — a **separate root branch (or separate project) that is seeded**, **not** a copy-on-write branch off prod. A branch off prod inherits the real PII this whole split exists to avoid; only a seeded root is genuinely synthetic. Evolves via `migrate deploy` on deploy, exactly like prod.
- **Clerk:** its own **development instance** (Clerk provides dev + prod side-by-side at no cost).
- **R2:** its own bucket / key prefix.
- **Email:** pointed at a **sink** (Resend test mode / catch-all), so a smoke-test send can never reach a real client.

Its job: after a merge, a human runs the critical-path checklist (§4) on a prod-shaped stack with fake data before promoting to prod.

### 4. Promotion — trunk + tag-triggered prod (ADR-0025 intact)

`main` is the only long-lived branch. Every squash-merge to `main` auto-deploys to the **smoke-test** environment. **Prod is held back** and reached only by pushing a release tag (`v*`).

Neither Railway nor Vercel deploys from a git tag natively (both track branches), so prod promotion is a small **GitHub Actions release workflow** triggered `on: push: tags: 'v*'`, which drives the prod deploys via the Railway/Vercel CLI. The payoff over a manual dashboard click is a **named, auditable release** (`v1.4.0`) and a single place to sequence the release steps (§6).

The smoke-test, by being the auto-deploy target of `main`, is *always* exercised before any tag is cut. Tagging is the human's attestation that the §4 checklist passed.

**Critical-path smoke-test checklist** (run manually before tagging; automate with Playwright once flows stabilise — auth session is already saved from #360):
sign in → create booking → issue invoice (number assigned, PDF stored) → send invoice (composer, attachment present, email sunk) → mark paid; contact create + delete-block (409); portal `/booking/:token` flow.

### 5. Migration discipline — expand/contract, mandatory for destructive changes only

The deployed app and the database do **not** cut over atomically; for a deploy window the running app must tolerate **both** the old and the new schema. Therefore:

- **Additive changes ship in one step** — a new nullable column, a new table, a new index. These are backward-compatible with the running app by construction.
- **Narrowing / destructive changes MUST use expand/contract** — dropping a column, renaming, narrowing a type, or adding `NOT NULL`/unique to existing data. Add the new shape → deploy → backfill → only in a *later* release drop the old shape.

This keeps ceremony proportional: the great majority of migrations stay one-step; only the genuinely dangerous ones pay the multi-release cost.

### 6. Rollback — named pre-migration Neon branch per release

The Neon project's PITR window is short (`history_retention_seconds` = 6h at time of writing), so a PITR timestamp is not a trustworthy net for a destructive migration noticed the next morning. The real safety net is a **named Neon branch snapshot of prod taken by the release workflow immediately before `migrate deploy`** (e.g. `pre-release-v1.4.0`). Unlike a PITR timestamp it is copy-on-write cheap, **persists until deleted** (survives well past 6h), and is inspectable/diffable. If a migration corrupts data, restore prod from that branch.

Release workflow order is therefore: **snapshot prod → migrate deploy → deploy API → deploy web.** (We chose *not* to raise the PITR retention window or add pg_dump backups for now — the named branch is the deliberate rollback target.)

### 7. Smoke-test seed — seed once, evolve via migrations

`seed.ts` populates the smoke-test DB once with **one synthetic user whose `id` equals a real Clerk-dev user's ID** (otherwise the `AuthGuard` scopes to the logged-in Clerk-dev userId and the seeded rows are invisible), plus fixtures spanning each state: draft / issued / sent / paid invoices, a series, a portal booking, a deletable and a delete-blocked contact. Migrations keep it schema-current like prod; it is **not** auto-reset per release, so smoke-tests run against data that has survived real migration history. Re-seed by hand if it gets messy.

### 8. Feature flags — environment/config flags for wave-2 dark launch

Trunk + promote means a half-built wave-2 feature on `main` would otherwise freeze prod for weeks. The escape is **not** a long-lived branch (ADR-0025) — it is feature flags. A flag is an **environment variable** (or a typed config object keyed off an env value): **on in the smoke-test env, off in prod.** Wave-2 merges to `main` continuously behind its flag; small changes keep shipping to prod the whole time; the prod flag is flipped on (env change + redeploy) once the feature is tested and ready.

Per-environment, not per-user — no LaunchDarkly, no flags table. (A DB-backed per-user flag system is a later option if betas/gradual rollout are ever wanted; explicitly out of scope now.)

## Consequences

- **Railway "promote" is commit-promotion, not artifact-promotion.** Railway rebuilds per environment from the same git SHA (deterministic Dockerfile), unlike Vercel which promotes the built artifact. Functionally equivalent for our purposes; worth knowing the prod build is a fresh build of the tagged commit, not the literal smoke-tested binary.
- **The smoke-test env carries no real data**, so it cannot catch data-shape surprises — that is precisely why migration rehearsal (§2) runs separately against a prod clone.
- **Rehearsal fidelity has a ceiling:** it validates *apply*, not *intent*. A correct-looking but destructive migration passes rehearsal. §5 and §6 are the real defence for that class.
- **The 6h PITR window is accepted as-is.** The named pre-migration branch is the rollback target; if a destructive change is noticed days later *and* the branch was already deleted, recovery is lost. Branch retention/cleanup is a manual discipline.
- **Two Clerk instances and two R2 buckets** now exist; env wiring (`VITE_API_BASE_URL`, `CLERK_*`, R2 creds, `RESEND_*`, `DATABASE_URL`/`DIRECT_URL`, feature-flag vars) must be set per environment and kept in `.env.example`. The web API base in particular moves from a hardcoded `vercel.json` rewrite to per-environment config (§3).
- **Number-sequence and PII notes from ADR-0042 are unaffected** — prod remains the only environment with real invoices and real contacts.
```
