# ADR-0024 — Tiered Storybook testing requirements by component type

## Status
Accepted

## Context

Storybook is used for three things in this project: inventory documentation (what components exist and how to use them), design verification (the presentational layer is always built and storiable before the container is wired up, per ADR-0023), and automated testing (stories run as vitest tests via `@storybook/addon-vitest`).

The question is what the minimum required bar is for each story's `play` function. Two failure modes to avoid:

1. **Too low:** stories exist but are so thin they catch nothing. A component can be visually broken, have incorrect state rendering, or fail its primary interaction — and the story passes because it only asserts "some element is visible."
2. **Too high:** full interaction coverage everywhere. Every state, every edge case, every error path — all in stories. This is wasteful duplication of unit test coverage and creates maintenance burden without proportionate safety benefit.

The right bar varies by component type. `components/ui/` are shadcn primitives — their behaviour is upstream, not owned code. Feature presentational components are the highest-risk surface because they encode real user workflows. Page stories exist mainly to catch wiring errors.

## Decision

Testing requirements are tiered by component type:

| Component type | Required `play` coverage |
|---|---|
| `components/ui/` | Smoke only — story renders, key elements are visible. Behaviour is upstream (shadcn); interaction testing here adds cost without benefit. |
| `components/common/` | Smoke + one `play` covering the primary use case (e.g. `StatusPill` renders the correct colour for each status variant; `EmptyState` renders with its CTA visible). |
| Feature presentational components | Interaction `play` covering the primary happy path (e.g. `ContactForm` fills in fields and submits; a table renders a row with the correct status pill). Edge cases and error paths are the domain of unit tests. |
| Page stories | Smoke only — the page renders without error. Page stories exist to catch import and wiring errors; full interaction coverage at page level is not required. |

A `components/common/` component without at least its primary-use-case `play` function is considered incomplete. The story is the usage documentation — the `play` function is the assertion that the documented behaviour is actually true.

## Alternatives considered

- **Uniform bar (interaction everywhere):** Rejected — shadcn primitives and page shells have no meaningful interaction to test at this level; the cost is high and the benefit is negligible.
- **Uniform bar (smoke everywhere):** Rejected — smoke tests for feature presentational components are too weak. A form that renders but fails to validate or submit would pass; that's the most important regression to catch.
- **Visual regression (Chromatic):** Deferred — noted in ADR-0022. Apply once the component library has stabilised.

## Consequences

- All new `components/common/` components require a `play` function at creation time. This is enforced by the component creation rule in CLAUDE.md.
- Existing stories below the required bar are updated opportunistically when next touched, not in a sweep.
- The tiered bar is the default. Justified exceptions (e.g. a `common/` component with no meaningful primary-use-case interaction) are noted in the story file.
