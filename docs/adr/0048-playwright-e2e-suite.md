# ADR-0048 — Curated real-stack Playwright end-to-end suite

## Status

**Accepted** — 2026-06-18

Amends **ADR-0040 §5** (Playwright dropped as a blanket per-slice verifier tier; see §9 below).
Does **not** supersede **ADR-0033** (Chromatic remains accepted-but-deferred; it covers a different failure mode — see Alternatives).

**Amended:** 2026-07-18 — onboarding promoted from deferred to a curated flow (slice 6), after the #478 rework turned it into a create-real-artifacts journey. See §7.

## Context

GigMan has grown to ~40 pages and six multi-step money-path journeys (booking lifecycle, contract signing via the portal, invoice issue → send → paid, contact management, onboarding). The manual cost of clicking through these journeys after every change is now high, and — more sharply — **breakage hides in the gaps the existing tiers don't cover**. The recent invoice-issued rework (ADR-0042) is the motivating case: its Jest unit tests and Storybook `play` functions were green, yet clicking through the issue→send journey by hand surfaced several defects, because nothing exercised the *cross-page flow against the real backend*.

The existing test tiers each have a structural blind spot:

- **Jest unit (api)** — services/repositories in isolation; no browser, no frontend.
- **Storybook `play` (web)** — single-component interaction against a **mocked** API (MSW); no cross-page flow, no real backend.
- **API integration (ADR-0032)** — real NestJS against an ephemeral Neon branch, but **headless** (Supertest, no browser, no frontend). Proves the API; never touches the wiring in front of it.

The uncovered gap is exactly the felt pain: **full-stack flow correctness from the browser, across pages** — the frontend sending the wrong payload, the API returning a shape the frontend doesn't expect, the Clerk session → JWT → `AuthGuard` chain, a DTO/migration desync. No tier tests the FE↔BE contract through a real browser.

ADR-0040 §5 listed "Playwright (end-to-end flows)" as a per-slice TDD tier, but **no infrastructure ever backed it** (no harness, no Clerk-in-test auth, no seeding, no CI job), so agents reasonably skipped it and ADR-0045's "CI is the sole gate" never required it. The directive was aspirational with nothing underneath.

## Decision

Build a **persistent, curated, real-stack Playwright suite** — a small set of the highest-value money-path flows, version-controlled, run in CI — and separate it cleanly from two other Playwright uses that are decided at different moments.

### 1. Real stack, not mocked

Playwright drives the **real built frontend → real NestJS API → real (ephemeral) database**. Only outbound third parties are faked (R2, email, Google Maps), at the same boundary the integration suite already mocks. We reject a mocked-API frontend suite: it would re-test frontend routing already covered by Storybook `play`, at higher cost, while leaving the FE↔BE contract — the actual gap — untested. We accept that real-stack browser tests are the slowest and flakiest tier we own; the value (catching the bug class we actually hit) justifies it. **Five rock-solid real-stack flows beat fifty mocked ones.**

### 2. In-CI booted stack now (A1); deployed smoke-test later (A2) — same specs

The substrate reuses ADR-0032: a CI job creates an ephemeral Neon branch, migrates, then **boots the API listening on a real port** (not in-process Supertest) plus the **served web build**, seeds, and runs Playwright against `localhost`. Every spec is written against a **configurable `baseURL`**, so the *same* specs later run against the #436 deployed smoke-test environment without rework.

**Relationship to #436 (preprod/release): not a dependency — a future consumer.** #436 story 7 is a *manual* critical-path checklist a human clicks after each deploy; the curated suite, pointed at the deployed URL, automates it. The dependency runs backwards: this work makes #436 cheaper, not the reverse. A1 ships independently now.

### 3. Auth: real Clerk dev instance + testing tokens

The browser must hold a real Clerk session to render protected pages, so an API-side `TestAuthGuard` bypass (as the integration suite uses) is insufficient. We use `@clerk/testing`: a **global setup** fetches a Clerk testing token (bypasses bot detection), signs in a **dedicated seeded test user** once, and writes `storageState` to disk; every spec reuses it. The API runs its **real `AuthGuard`** — the Clerk session → JWT → guard chain is under test, which is the point. We reuse the **existing dev Clerk instance** (`pk_test`) with a dedicated test user rather than standing up a separate instance. The test user's stable Clerk `userId` becomes the equivalent of the integration suite's `TEST_USER_ID` — the id whose data we seed into the fresh branch. The exploratory `.playwright-cli/auth-playwright-test.json` snapshot is obsoleted: it proved the approach but is a static, expiring, CI-unusable capture, not a reproducible harness.

### 4. Third-party fakes become env-driven, not Jest mocks

The integration suite swaps R2/email/Maps via `jest.fn()` + `.useValue()` at `TestingModule` compile time — only possible in-process. A separately-spawned real API process cannot receive Jest mocks, so the API gains a **test-mode (env flag)** that boots with sink/fake implementations (email → sink, R2 → fake store, Maps → fixed distance). These fakes are the **same ones #436 needs** (sink email, own R2 bucket) and are built to be shared.

### 5. Test data: thin shared baseline + per-test fixtures

- **Account scaffolding** seeded once per run in global setup: the test user's `Profile` with `onboardingCompletedAt` set — **mandatory**, because `AdminLayout` redirects any user with `onboardingCompletedAt === null` into the onboarding wizard, so no admin screen renders without it.
- **Per-test fixtures** seeded per spec via **direct Prisma writes** (the `@gigman/api` client, as `test-prisma.ts` uses).
- **Discipline: arrange via the DB, act through the UI, assert via UI + DB.** Only the behaviour under test goes through the browser; prerequisites are seeded directly. The exception is a flow whose *point* is the UI-building journey (e.g. create-booking), where the create itself is the act.
- **One ephemeral branch per run, serial (`workers: 1`), each spec self-contained** (assert on *this* entity, not on global counts). Parallelism is deferred as premature; it buys flake against a shared user/branch.

### 6. CI: non-blocking with retries now, deliberate promotion to required later

Ships as a `continue-on-error` informational job with `retries: 2`, mirroring how integration testing entered (ADR-0032). After it proves stable across ~10–15 real PRs, it is **deliberately promoted to a required check** — the separate, low-drama step at which it actually replaces manual testing (a red required check stops a merge you'd otherwise have hand-verified). Runs on PRs where **web or api changed** (reuse `detect-changes`); skipped on docs-only.

### 7. Scope: harness + five curated flows, one slice each

Built as tracer-bullet vertical slices on one branch → one PR:

1. **Harness + invoice money path** (issue → send → mark paid) — slice 1 proves the entire spine on the hardest case (PDF → fake R2, email → sink).
2. **Create booking** (the UI-building journey).
3. **Contract sign via portal** (`/booking/:token` — bypasses Clerk; needs a booking + contract seeded with a `portalToken`).
4. **Contact delete blocked** (the 409 hard rule surfaces in the UI).
5. **Booking lifecycle** — work the checklist from its current stage through to Complete (exercises the checklist state machine, stage gating, auto-complete rules).

6. **Onboarding flow** (promoted 2026-07-18) — walk the five-step wizard: fill the required business step, configure one Package Template from a catalogue starter (`POST /packages`), add a first song (`POST /songs`), and complete (`POST /me/onboarding/complete` → redirect to `/admin`). The #478 rework turned onboarding from "click through defaults" into a **create-real-artifacts** journey, so it now carries genuine cross-page + FE↔BE contract value (originally deferred as low money-value / partly exercised via baseline seeding). It runs onboarding-**incomplete** via `setOnboardingIncomplete`/`restoreOnboardingComplete` seed helpers (the shared baseline is onboarding-complete, which `OnboardingLayout` treats as a redirect-to-`/admin` signal), and is mobile-only (single-column, no DOM divergence, so it is not added to the `desktop-chromium` project).

### 8. Layout and local DX

A new **top-level `e2e/` workspace** (own `package.json`, `playwright.config.ts`, `global-setup.ts`, `specs/`) — it spans both apps and belongs in neither. Imports `@gigman/api`'s Prisma client for seeding. Run locally with `bun run test:e2e` (mirrors CI: branch → migrate → boot → seed → run → teardown) and `bun run test:e2e -- --ui` for authoring/debugging — the latter is also the tool agents use for the planning-directed walkthroughs in §9.

### 10. Viewport: 375px primary, 768px selectively (resolved at PRD, 2026-06-18)

GigMan is mobile-first (375px hard rule) and the UI **genuinely diverges at `md` (768px)** — bottom tab bar vs sidebar, plus booking-detail's mobile tabs (Checklist / On the Day / Info). The viewport a flow runs at changes *what DOM it exercises*, so it is a deliberate call. **Decision:** the suite runs at **375px (mobile) as the primary target** — the primary design target and where the bottom-tab-bar navigation lives — and adds a **768px variant only for the specific flows whose desktop DOM diverges** (booking lifecycle / booking detail), rather than running every flow at both widths (which doubles runtime on the slowest tier for little extra coverage). Mirrors ADR-0033's deliberate 375 + 768 choice for Chromatic.

### 9. Three Playwright uses, separated by who decides and when

| Use | Decided by | When | Purpose |
|---|---|---|---|
| **Curated suite** (this ADR) | this ADR | every CI run | regression safety, forever |
| **Planning-directed CLI journey walkthrough** | the **issue** (`issue-authoring.md`) | during the slice that changes a journey | catch new-development breakage (the invoice case) before commit |
| **Free-form CLI debugging** | the agent | ad hoc | available via the `playwright-cli` skill; never mandated |

This **amends ADR-0040 §5**: the per-slice TDD tiers are **Jest (logic) + Storybook `play` (component interaction)**; Playwright is no longer a blanket per-slice tier. End-to-end coverage is this curated suite, run in CI. Whether a journey-touching slice additionally warrants (a) a CLI walkthrough now and/or (b) a new/updated curated spec is a **planning-time decision recorded in the issue** — consistent with ADR-0030 (judgement belongs to planning). `issue-authoring.md` gains that decision alongside the existing component-reuse and story passes.

## Alternatives considered

- **Mocked-API frontend suite.** Faster and deterministic, but misses the FE↔BE contract — the only gap nothing else covers — and overlaps Storybook `play`. Rejected (§1).
- **Chromatic instead of / before Playwright (ADR-0033).** A false dichotomy: Chromatic answers "did the pixels change?", Playwright answers "does the flow work?". The felt pain is flow correctness, and visual regression "is really not proving to be an issue at present." Chromatic stays deferred, untouched, as its own future decision.
- **Playwright-per-slice (ADR-0040 §5 as written).** Comprehensive but the suite rots: real-stack tests are the costliest tier, and a solo dev pays it on every feature forever until everyone hits "skip." Rejected in favour of a curated set + planning-directed walkthroughs (§9).
- **Blocking gate from day one.** Day-one flake on the flakiest tier trains bypass habits. Rejected for non-blocking-then-promote (§6).
- **Separate dedicated Clerk test instance.** Unnecessary now; the existing dev instance + a dedicated test user is lighter. Revisit if #436 isolation demands it.
- **Frontend-mocked Clerk (Storybook's `clerk-mock.ts`) + `TestAuthGuard`.** Fully offline, but tests a fake auth path — self-defeating for a suite whose premise is real wiring. Rejected (§3).

## Consequences

- The API must grow an **env-driven test mode** with shareable sink/fake adapters (R2, email, Maps) — net-new work that #436 also consumes.
- A new top-level **`e2e/` workspace** enters the monorepo (lint/build/CI wiring follows).
- A **dedicated Clerk test user** must exist on the dev instance; CI needs the Clerk testing-token secret and Neon branch credentials the integration job already uses.
- **Two doc edits ship with this work:** ADR-0040 §5 (drop Playwright as a per-slice tier; point e2e here) and `docs/agents/issue-authoring.md` (planning-time "does this slice change a user journey?" decision).
- The suite is **non-blocking until deliberately promoted** — until then it informs, it does not gate; the promotion is the moment it replaces manual testing.
- `.playwright-cli/auth-playwright-test.json` and its exploratory artefacts are obsolete once the harness lands.
