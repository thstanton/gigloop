# Issue authoring (the planning gate)

How a feature is broken into issues *before any code is written*. This is the calm, fresh, human-in-the-loop moment where the judgement that is unreliable at coding time gets made once and made visible. See ADR-0030.

`/to-issues` and `/grill-with-docs` are generic, user-global skills — they provide the machinery (vertical slicing, grilling) but know nothing about GigLoop. This document is the GigLoop-specific spec their output must conform to. **When authoring issues for this repo — whether via `/to-issues` or by hand — produce issues that meet every requirement below, then get the human's approval before coding.**

## When the gate applies

- **Non-trivial features** → planning gate is mandatory. I draft the tracking issue + sub-issues, the human approves/adjusts, *then* code begins.
- **Trivial fixes** (one file, no new UI, no schema change) → skip the gate; go straight to a `fix/` branch.

If unsure whether something is trivial, treat it as a feature and plan it.

When planning a non-trivial feature, consult `docs/north-star.md` (the Wave 2 / P2 direction) for
**plumb-it-forward** opportunities — a cheap nullable field, a generic shape, or a preserved timestamp
now that makes a future pillar materially easier later, without bending the current feature out of
shape. The North Star is directional, not a constraint.

## What the gate produces

A **tracking issue** (umbrella; durable dependency map) whose body lists sub-issues as a task list with `Blocked by` links, plus the sub-issues themselves. Every sub-issue must be:

### 1. Vertically sliced
Each sub-issue ships a thin, working capability end-to-end — *not* a horizontal layer. "Schema migration" alone is a layer, not a slice: it can't be reviewed or tested in isolation and it forces everything downstream to depend on it. Slice by capability (a narrow feature through schema → API → UI), not by tier. Horizontal slicing is what creates dependency chains and merge conflicts.

### 2. Session-sized
Each sub-issue is completable within **one healthy context window** — roughly one session's safe increment. A sub-issue that can't be finished before context degrades is too big; split it. The branch persists across sessions, so a feature spanning several sessions is normal and fine — but no single sub-issue should require ploughing through a degrading context.

### 3. Dependency-mapped
The tracking issue records order and dependencies (`Blocked by #N`). I advance the map **one unblocked sub-issue at a time**; it is not a goal to complete in one sitting.

### 4. Reuse-annotated (UI issues)
Before writing the issue, do the **component inventory pass** (see `apps/web/src/components/ui` and `components/common`, and Storybook). Name the components the issue should use directly in the issue body — e.g. "empty state via `EmptyState`", "wrap in `Card`", "header via `PageHeader`". The reuse decision is made here, once, where the human can catch a missed component at planning time rather than in a diff. If a genuinely new shared component is needed, the issue says so explicitly and flags it for approval (creating `components/common` or `components/ui` files requires approval — see CLAUDE.md).

### 5. Story-task-bearing (UI issues)
Story creation is an **explicit task**, sequenced **before** the component build (presentational-first, ADR-0023). The story is a deliberate review checkpoint: the human reviews the presentational component in Storybook *before* the container is wired up. Structure UI work so the story is its own commit boundary — "build story → STOP → review → build component" lines up exactly with the session-stop rule (CLAUDE.md → Session Behaviour).

### 6. Model-annotated
Every sub-issue states the recommended model at the top and flags individual tasks as **Haiku candidates** where applicable. This is decided at planning time so it can be applied dynamically during implementation — Claude spawns a Haiku subagent for flagged tasks rather than handling them in the main Sonnet session.

**Cut point:** Haiku for tasks where the full context fits in one file and the pattern is visible from a single example (smoke stories, small DTO changes, isolated label/display tweaks). Sonnet for anything requiring reading multiple files to infer the correct pattern (new components, API endpoints, mutation wiring).

Format in the issue body:

```
## Recommended model: Sonnet

[Overall rationale. Name any individual tasks as Haiku candidates inline, e.g.:]
The DTO update and smoke story are Haiku candidates — flag them as such in the task list.
```

At implementation time: when a Haiku-candidate task is reached, spawn a Haiku subagent via the Agent tool with `model: "haiku"`, passing the target file path, an existing file to use as a pattern, and the exact change required. Log the spawn so the human can observe success/failure and build intuition for future calibration.

### 7. Journey-annotated (does this slice change a user journey?)
End-to-end coverage is **not** a per-slice tier — it is the curated real-stack Playwright suite (**ADR-0048**). So at planning time, ask of each slice: **does it change a money-path user journey?** (booking lifecycle, contract signing via the portal, invoice issue → send → paid, contact management, onboarding). If yes, the issue records a deliberate decision on two independent questions:
- **A new/updated curated spec?** — if the slice alters a flow the suite covers (or should), name the spec to add or update as an explicit task. If it doesn't warrant one, say so — silence is not a decision.
- **A CLI walkthrough now?** — for new-development breakage the suite doesn't yet guard (the ADR-0048 motivating case), the issue may direct a one-off `bun run test:e2e -- --ui` walkthrough before commit. This is separate from adding to the permanent suite.

Most slices touch no journey and record "no journey change." Like the reuse and story passes, this is a planning-time judgement (ADR-0030) captured where the human can catch a gap.

## Branch & PR shape (set at planning time)

- **One feature = one branch = one PR.** Sub-issues are commits on that branch (`Closes #N` in the commit body; all closed in the PR description). **Never** split a dependent feature into sibling branches — that is the squash-merge conflict footgun (see ADR-0025).
- If a feature is genuinely too large for one reviewable PR, split it into **sequential** tracking issues — each its own branch → PR → merge *before the next starts*. Never parallel.

## Checklist for the human to approve

Before coding starts, the human should be able to see, in the issues:

- [ ] Each sub-issue is a vertical capability, not a layer
- [ ] Each sub-issue fits one session
- [ ] Dependencies are mapped on the tracking issue
- [ ] UI sub-issues name the components to reuse
- [ ] UI sub-issues include a story task, sequenced before the build
- [ ] Journey-touching sub-issues record the curated-spec / CLI-walkthrough decision (ADR-0048)
- [ ] Each sub-issue has a model recommendation; Haiku candidates are flagged inline
- [ ] One branch / one PR for the whole feature (or an explicit sequential split)
