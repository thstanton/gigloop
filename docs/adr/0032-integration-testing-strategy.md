# ADR-0032 — Integration testing strategy

**Status:** Accepted
**Date:** 2026-06-04

API integration tests are the primary regression layer. Each suite spins up the full NestJS app against a fresh Neon branch (created at CI start, deleted at end), so every run is at migration tip with no cross-contamination. Auth is handled by a `TestAuthGuard` that injects a fixed `userId` into the test module only — the production `AppModule` always uses the real `AuthGuard`, so there is no backdoor. Fixtures are created via Prisma directly in `beforeAll`/`afterAll` (fast, explicit); assertions are made via Supertest HTTP calls (exercises the real request path). External HTTP dependencies (Google Maps, Resend) are mocked at the NestJS module boundary — we are not testing that Google's API works, we are testing that our code handles the response correctly. Integration tests run as a separate CI job on every PR to `main` with `continue-on-error: true` — they are informational, not a gate. See ADR-0025 amendment 2026-06-06.

## Considered Options

**Persistent test Neon branch (truncate + re-seed per run):** simpler to set up, but shared state risks intermittent failures if cleanup is imperfect. Rejected in favour of branch-per-run isolation.

**Real Clerk tokens in tests:** maximally realistic but adds CI fragility and a Clerk API dependency for no meaningful gain — auth correctness is Clerk's problem, not ours. Rejected.

**Chromatic visual regression:** identified as complementary but tracked separately (issue #181 covers API integration; Chromatic is its own issue). Not bundled here to avoid scope coupling.

## Coverage priority

1. Booking lifecycle (create, status transitions, cancel)
2. Contract flow (draft → send → portal sign)
3. Invoice flow (create, mark paid, deposit tracking side-effects)
