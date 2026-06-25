# ADR-0055 — Production database is hosted in London (Neon `eu-west-2`), co-located with the Railway API

## Status
Accepted (2026-06-25). Operational/infrastructure decision. Relates to [ADR-0044](0044-preprod-and-release-process.md) (preprod & release process — the home for the migration-pipeline follow-up noted below).

## Context

The NestJS API runs on **Railway in EU-West** (GCP `europe-west4`, Netherlands). The production Postgres (Neon) was originally provisioned in **AWS `us-east-1`** (N. Virginia). Every query therefore crossed the Atlantic — **~80ms round-trip** — and the app's chattier paths issue several *serial* round-trips per interaction (e.g. a checklist toggle: write-the-toggle → evaluate-fetch-context → write-updates → client refetch), which multiplies that per-hop cost into a visibly sluggish interaction.

UAT surfaced this as broad slowness **"even when the database is warm"** — i.e. not Neon scale-to-zero cold starts, which were the expected and accepted trade-off.

Diagnosis separated two distinct costs:

- **Server-side query execution** — Neon's engine on a ~10MB database: fast. Not the problem.
- **Network / connection latency** — the dominant cost. Connection setup was already correct (pooled TCP via PgBouncer; `PrismaService` is a singleton, so no per-request connection churn). The latency was **region distance × round-trip count**, not the driver or the query engine.

A Neon project's region is **fixed at creation** — it cannot be relocated in place — so reducing the distance required migrating to a new project in a European region. Neon runs on AWS/Azure (no GCP), so "co-located in Europe" is still cross-*cloud* (Railway GCP ↔ Neon AWS), but intra-Europe RTT (~5–15ms) is an order of magnitude better than the transatlantic hop, which is the win that matters.

## Decision

**Host the production database in Neon AWS London (`eu-west-2`), co-located with the Railway API, on Postgres 18.**

1. **Region.** London (`eu-west-2`) — closest Neon AWS region to both the Railway EU-West compute and the UK-centric user base.
2. **Version.** Postgres **18**, taken as a clean-slate upgrade from 17 during the move (a fresh 10MB project is the lowest-risk moment to jump majors; PG17 dump restores into PG18 cleanly).
3. **Mechanism.** Migrated 2026-06-25 via `pg_dump`/`pg_restore` over the **direct** (non-pooler) endpoints into a new Neon project `Gigman2` (`curly-forest-25260742`). All 20 tables **and** the `_prisma_migrations` history were verified row-for-row matching against source. `pg_stat_statements` was enabled on the new project for future query profiling.
4. **Cutover.** Railway `DATABASE_URL` repointed to the London **pooled** endpoint (preserving `sslmode=require&channel_binding=require&pgbouncer=true`); local `apps/api/.env` `DATABASE_URL` + `DIRECT_URL` repointed too, since `prisma migrate deploy` is currently run from a developer machine rather than CI.

## Consequences

- **Latency.** Removes the ~80ms/hop transatlantic penalty; the chattiest paths (checklist, list views) benefit most. Application-level round-trip reduction — the perf quick-wins (tracking #584) and the parked checklist-evaluator redesign — compound on top but are now **lower urgency**, to be prioritised against real `pg_stat_statements` data.
- **Cross-cloud co-location is good enough.** Railway (GCP) ↔ Neon (AWS) within Europe is single-digit-ms; same-cloud co-location (e.g. moving the DB onto Railway's own Postgres) is **not** worth pursuing for this gain.
- **Rollback.** The old `us-east-1` project `late-frost-04458470` is retained briefly as a rollback target, then deleted once London is proven.
- **Why this is recorded.** Future region/provider questions (e.g. the parked Neon-Auth + RLS direction for band-member accounts, or any DB-host change) should start from this rationale: the move was driven by **latency, not provider dissatisfaction**, and the binding constraint is that **Neon region is fixed per project** (a change means a migration, never an in-place move).
- **Process debt.** Running `prisma migrate deploy` from a laptop against production is fragile; folding it into a gated pipeline is future work under [ADR-0044](0044-preprod-and-release-process.md)'s release process.
