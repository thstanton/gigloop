# ADR-0030 — Agent-native workflow: automate the deterministic, plan the judgement, advise don't trap

**Status:** Accepted
**Date:** 2026-06-01

## Context

The project had accreted quality and process machinery in layers: a pre-flight per-file check, a blocking commit hook, a prose pre-commit checklist, a prose pre-PR checklist, a CodeScene 10.0 gate at three moments, `/simplify` on every changed file, a Storybook story requirement, a UI component-inventory rule, and a tracking-issue model. In practice these *conflicted and added friction*:

- The commit hook (lint + test) and the prose pre-commit checklist (lint + build + CodeScene) overlapped and diverged — lint ran twice, test and build were split across two mechanisms, requiring reconciliation by hand and producing multiple passes per commit.
- The CodeScene 10.0 hard gate drove refactor-until-perfect loops *inside* feature commits and gate-appeasement churn commits, and encouraged shortcuts to "make it pass."
- The Storybook and component-reuse rules — pure judgement living in prose — were the things that got skipped, because deterministic-check noise crowded them out of working memory at coding time.
- The tracking-issue model (introduced so the human could track order/dependencies across many issues) handed the agent a large goal and an implicit "complete it" instruction; the agent ploughed on through a degrading context window. The BookingSeries feature was also split into dependent sibling branches, causing squash-merge conflicts.

Root insight: every rule is either **deterministic** (lint, typecheck, build, test — binary, identical every run) or **judgement** (slice size, which component to reuse, is this story meaningful). They were all living in the same prose checklists, which made the deterministic checks *unreliable* (the agent forgets to run them, or runs them inconsistently) **and** crowded out the judgement rules. An agent reads the codebase fresh each session and has no persistent memory; prose it must remember mid-task is the least reliable place for anything.

## Decision

Match each kind of check to the mechanism that suits it.

1. **Deterministic → automation, never agent memory.**
   - `commit` hook: `lint` (changed workspace only) — fast, blocking.
   - `push` hook: `test + build` (changed workspace) — `build` subsumes typecheck.
   - CI: `lint + test + build` (both apps) — backstop.
   - The prose pre-flight and pre-commit checklists are deleted. The agent does not hand-run these.

2. **Advisory → inform, never trap.** CodeScene becomes a navigator (proactive hotspot list, refactoring as its own deliberate work) with a single PR-time `analyze_change_set` that is *reported*, not looped on; target "no meaningful regression," not 10.0. `/simplify` is signal-driven (CodeScene-flagged files + 300-line crossers), not blanket. See ADR-0026 amendment.

3. **Judgement → made once, up front, in planning.** Non-trivial features go through a **planning gate** before any code: the agent drafts a tracking issue + vertically-sliced, session-sized, dependency-mapped sub-issues, with reuse decisions and story tasks baked in, and the human approves. This moves the reuse/story/slicing judgement out of the loaded coding moment into a calm, reviewable one. See `docs/agents/issue-authoring.md`.

4. **Session-scoped increments.** The feature branch persists across sessions; the agent's context does not. The agent **stops by default at every commit boundary** and hands off (clean commit + tracking-issue update + handoff comment), rather than ploughing through a degrading context to finish the tracking issue. Stopping cleanly is the success condition.

5. **One branch per feature.** Sub-issues are commits, never sibling branches. See ADR-0025 amendment.

6. **No silent shortcuts.** Any path that would lower the bar (disable, `any`, weak/skipped test, hollow story, fudged check) → the agent stops and surfaces the trade-off; the human decides. Surfacing is success.

7. **Story presence automated; quality stays judgement.** A CI scan fails when a component/page lacks a sibling `.stories.tsx`. Story quality follows ADR-0024 tiers.

## Consequences

- CLAUDE.md shrinks to judgement and convention; deterministic enforcement moves to hooks + CI; project-specific planning requirements move to `docs/agents/issue-authoring.md`. The global `/to-issues` and `/grill-with-docs` skills stay generic.
- The human is in the loop at planning (when the agent is fresh) and at review checkpoints (stories, session handoffs), rather than policing diffs after the fact.
- Features routinely span multiple sessions on one persistent branch — this is expected, not a failure.
- This is reversible but with churn (hooks, CI, and CLAUDE.md would all need reverting), and it deliberately trades enforcement *strength* (the 10.0 gate, the every-commit safeguards) for reduced friction and reliability — hence this record.
