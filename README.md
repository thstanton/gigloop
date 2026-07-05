# GigLoop

**A CRM built for working musicians** — bookings, contacts, repertoire, invoicing and a branded client portal, in one place designed for the phone in your pocket.

GigLoop treats every booking as a small project. It tracks the gig from first enquiry to post-event wrap-up, surfaces the next thing that needs doing, and handles the paperwork — quotes, contracts, invoices and set lists — so the musician can spend less time on admin and more time playing.

---

## What it does

- **Manage every booking as a project.** A booking moves through a clear lifecycle — Enquiry → Provisional → Confirmed → Ready → Complete — with a smart checklist that surfaces the right action at the right moment instead of leaving you to remember it.
- **A branded client portal.** Share one link and your client can review the details, e-sign the contract, and complete the pre-gig music form — all under your own logo and colours.
- **Contracts, invoices & PDFs.** Generate deposit and balance invoices, issue and send them, and produce polished PDFs — created server-side and streamed straight to the client.
- **Repertoire & set lists.** Keep your song library and build the running order (the Itinerary) for each event, grouped into packages and shared cleanly on the portal.
- **Communication templates.** Reusable, rich-text email templates with variable substitution, so the quote, contract note and thank-you go out consistently every time.
- **A dashboard that nudges.** Upcoming gigs, outstanding actions and reminders are surfaced automatically — GigLoop tells you what needs attention rather than making you go looking.

---

## Tech stack

| Area | Stack |
|------|-------|
| **Web** (`apps/web`) | React 18, Vite, React Router v7, TanStack Query & Table, Tailwind CSS, Radix UI, Tiptap (rich text), Clerk, Storybook |
| **API** (`apps/api`) | NestJS 11, Prisma 6 + Neon (serverless Postgres), Clerk, Cloudflare R2 (S3 SDK), Resend, pdfmake, Swagger |
| **Tooling** | bun workspaces, Playwright (e2e), Vitest / Jest, ESLint, GitHub Actions |

---

## Monorepo layout

| Path | Contents |
|------|----------|
| `apps/web` | React + Vite frontend (the musician-facing app and client portal) |
| `apps/api` | NestJS backend — REST API, Prisma data layer, PDF & email pipelines |
| `e2e` | Playwright end-to-end suite (real-stack, per ADR-0048) |
| `docs/` | Architecture Decision Records (`adr/`), the `north-star.md` roadmap, and agent guides |
| `scripts/` | Repo tooling (e.g. the pre-commit shortcut detector) |
| `.githooks/` | Committed git hooks (lint on commit, test + build on push) |

---

## Getting started

### Prerequisites

- **Node 24** (see `.nvmrc` — `nvm use` picks it up)
- **[Bun](https://bun.sh)** as the package manager and task runner

### Setup

```bash
git clone <repo-url> gigloop
cd gigloop
bun install

# Configure the API environment (see "Environment variables" below)
cp apps/api/.env.example apps/api/.env
#   …then fill in the values from each service console

# Start both apps (API + web) together
bun run dev
```

`bun run dev` runs the API and the web app concurrently. The web app is served at **http://localhost:5173** by default.

---

## Environment variables

The API is configured entirely through `apps/api/.env`. **`apps/api/.env.example` is the canonical, commented list** — copy it and fill in the values. Every variable below is described by name only; get the actual values from the relevant service console.

> ⚠️ **Never commit `.env`, and never paste live values (connection strings, API keys, tokens) anywhere.** A database connection string embeds a password and is a secret. Local dev uses its own dev-scoped credentials and buckets — never the production ones.

| Variable | Where to get it |
|----------|-----------------|
| `DATABASE_URL` | Neon console → your project → Connection Details (**pooled** `-pooler` host) — used at runtime |
| `DIRECT_URL` | Neon console → Connection Details (**direct**, non-pooled host) — used by Prisma for migrations |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `R2_ACCOUNT_ID` | Cloudflare R2 dashboard → account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 dashboard → Manage R2 API tokens |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 dashboard → Manage R2 API tokens |
| `R2_BUCKET_NAME` | Public assets bucket (logos/photos) — e.g. `gigloop-dev-public` |
| `R2_PUBLIC_URL` | Public URL for the assets bucket (custom domain or the `r2.dev` subdomain) |
| `R2_DOCUMENTS_BUCKET_NAME` | Private documents bucket (contracts, invoices) — e.g. `gigloop-dev-documents` |
| `ENCRYPTION_KEY` | AES-256-GCM key (exactly 64 hex chars) for encrypting bank details at rest — generate locally |
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `RESEND_FROM` | The from-address for outbound email (`onboarding@resend.dev` for dev) |
| `APP_BASE_URL` | Frontend base URL, used to build portal links (`http://localhost:5173` in dev) |
| `CORS_ORIGIN` | Allowed CORS origin for the API (the frontend URL) |
| `GOOGLE_MAPS_API_KEY` | Google Cloud console → Distance Matrix API key (for travel-time calc) |
| `FEATURE_EXAMPLE` | Feature-flag example — default-off; unset/`false`/`0` = off |
| `E2E_TEST_MODE` | Set only by the Playwright harness (fakes outbound adapters) — leave off everywhere else |
| `SEED_USER_ID` | Clerk-dev user id used by `bun run seed` |

---

## Common commands

Run from the repo root:

| Command | Does |
|---------|------|
| `bun run dev` | Start API + web in dev mode (concurrently) |
| `bun run build` | Build all workspaces |
| `bun run lint` | Lint all workspaces |
| `bun run test` | Run all unit tests |
| `bun run test:e2e` | Run the Playwright end-to-end suite |
| `bun --filter @gigloop/api run test -- --testPathPattern=<file>` | Run a single API test file |

Deterministic checks are automated via git hooks (lint on commit; test + build on push) and re-run in CI — you don't need to run them by hand. Hooks require a one-time opt-in: `git config core.hooksPath .githooks`.

---

## CI/CD & environments

Checks run in layers, so problems surface early and `main` stays releasable (see [`CLAUDE.md`](./CLAUDE.md) and ADR-0044 for the full rationale):

- **Git hooks (local, opt-in):** lint on commit, test + build on push.
- **CI on every PR to `main`** (`.github/workflows/ci.yml`): **Lint**, **Test** and **Build** are required and must pass to merge. **Integration** and **E2E** (Playwright) also run — each spins up an ephemeral Neon branch — but are informational, not merge-blocking.

Merging is **squash-only**, and deployment is promotion-based rather than tied to the merge:

| Trigger | Environment | Workflow |
|---------|-------------|----------|
| Squash-merge to `main` | **Preprod** — prod-shaped, synthetic data (smoke-test env) | `ci.yml` → deploy |
| Human pushes a `v*` git tag | **Production** — snapshot a durable `pre-release-<tag>` Neon branch, `migrate deploy`, then deploy API (Railway) + web (Vercel) | `release.yml` |
| Manual (before a schema release) | Rehearses the migration against an ephemeral clone of prod and reports apply-clean + lock time | `migration-rehearsal.yml` |

Production ships **only** on a deliberate human-pushed tag — a merge to `main` never reaches real users on its own.

---

## Documentation

The deep documentation lives alongside the code and is the living source of truth:

- **[`CLAUDE.md`](./CLAUDE.md)** — hard rules, conventions, commands and the workflow model
- **[`CONTEXT.md`](./CONTEXT.md)** — the domain model: booking lifecycle, entities and design principles
- **[`docs/adr/`](./docs/adr/)** — Architecture Decision Records (the reasoning behind key choices)
- **[`docs/north-star.md`](./docs/north-star.md)** — the directional roadmap for the next wave of features
- **[`SPEC.md`](./SPEC.md)** — historical pre-MVP reference (partly stale; `CLAUDE.md` and `CONTEXT.md` win where they disagree)

---

## Project status & contributing

GigLoop is a greenfield, actively-developed project. Development follows a **feature-branch → PR → squash-merge to `main`** model; merging to `main` deploys to a preprod smoke-test environment, and production ships only on a human-pushed `v*` git tag. The full workflow, branching rules and code-quality gates are documented in [`CLAUDE.md`](./CLAUDE.md).

_Private project — all rights reserved._
