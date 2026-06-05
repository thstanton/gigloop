# ADR-0033 — Chromatic for visual regression testing

## Status
Accepted

## Context

ADR-0024 deferred visual regression via Chromatic until "the component library has stabilised." With 55+ stories across ui, common, and feature layers, and with Playwright identified as the future tool for page-level interaction testing, the library is stable enough to baseline. The gap that prompted this decision: play functions (ADR-0024) catch interaction logic regressions; nothing was catching silent style/layout regressions — a removed Tailwind class, a changed colour token, a broken grid. The musician has a good eye for visual changes when reviewing PRs, but that is manual effort that scales poorly as the app grows.

## Decision

Chromatic is added as a non-blocking PR check. It runs on every PR, snapshots all stories at 375px and 768px (the two structural breakpoints in the mobile-first layout), and diffs against the `main` baseline. Visual changes are flagged in the PR but do not block merge. Baselines advance when changes are accepted in the Chromatic UI.

The tiered play-function bar from ADR-0024 is unchanged. Chromatic adds visual regression orthogonally — it does not replace interaction tests, and interaction tests do not replace it.

## Consequences

- `chromatic` package added to `apps/web` devDependencies.
- A `chromatic` CI job runs on every PR alongside Lint/Test/Build. It is non-blocking (`--exit-zero-on-changes`).
- `CHROMATIC_PROJECT_TOKEN` is stored as a GitHub Actions secret.
- Chromatic runs play functions before snapshotting, so stories with play functions snapshot their end state. Stories that render loading/empty states due to missing MSW handlers produce useless regression targets — a one-time audit of feature presentational stories is required before baselines are meaningful.
- Page stories remain smoke-only (ADR-0024). Chromatic provides their visual regression coverage; page-level interaction testing is the future domain of Playwright.

## Alternatives considered

- **Page-level Storybook play functions instead of Chromatic:** Considered when the cost of manual interaction testing on complex pages (e.g. BookingDetailPage with ~100 possible actions) was raised. Rejected — Storybook play functions operate within a component's props boundary and are not designed for full user journeys. Playwright is the right tool for that; it is deferred, not replaced.
- **Blocking PR gate:** Rejected for a solo project where intentional visual changes should not hold up unrelated fixes. Non-blocking with manual review is the right default; promote to blocking if regressions slip through repeatedly.
- **Subset of stories (common/ only):** Rejected — snapshot budget at this scale (55 stories × 2 viewports ≈ 110/run) makes full coverage free. Page stories catch layout regressions that component stories miss.
