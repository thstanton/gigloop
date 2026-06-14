# ADR-0040 — Agent loop: cold-restart AFK execution over GitHub-scoped, vertically-sliced work

**Status:** Accepted
**Date:** 2026-06-14

## Context

ADR-0030 established an agent-native workflow: deterministic checks automated, judgement front-loaded into a planning gate, advisory tools that inform rather than trap, and **session-scoped increments where the agent stops by default at every commit boundary and hands off to a human** — because the agent's context degrades across a long session and ploughing on through it produces bad work.

That stop-and-hand-off rule treats the *human* as the only safe way to reset a degrading context. The "Ralph Wiggum" technique (Geoffrey Huntley; analysed at length on aihero.dev and ralphwiggum.org) offers a second way: run the agent in a loop where **each iteration is a fresh process with empty context**, rebuilding state from files + git + the issue tracker. The cold restart *is* the context reset — the same thing the human handoff was protecting, achieved without a human in the seat.

This reframes ADR-0030 point 4 rather than contradicting it. The principle ("never plough on through a degrading context") is unchanged; AFK mode satisfies it by restarting the process instead of stopping for a person.

Adopting this surfaced two further facts:

- **The deterministic hooks ADR-0030 assumes do not exist.** There is no `husky`, no `lint-staged`, no `core.hooksPath`, and `.git/hooks/` holds only `.sample` files. Lint/test/build run only in CI on the PR. This is why PRs routinely fail lint despite the documented "commit → lint" hook — that hook was never implemented. The loop's safety model depends on these gates, so building them is a **prerequisite**, not an enhancement.
- **CodeScene is documented (ADR-0026) as a navigator, explicitly "not an automatic refactor loop."** A future entropy/refactor loop must be reconciled with that, not bolted on in violation of it.

## Decision

Adopt a **cold-only agent loop** for AFK execution of pre-planned, vertically-sliced work, with the following shape.

1. **One cold loop, external to the harness, with three modes.** A single `ralph.sh` runs `claude -p` once per iteration with empty context; verification feedback and progress cross the cold-restart boundary via files on disk — never a warm in-session retry. There is no separate "inner" and "outer" loop machinery: every iteration is identical, and the only thing distinguishing "grind one issue to done" from "move to the next" is a **selection-and-stop policy**, which is a parameter, not an architecture. Three rungs:
   - `ralph.sh --once N` — one cold pass on pinned issue `N`; you are the loop.
   - `ralph.sh --issue N` — cold-restart until pinned issue `N` is complete (or escalated), then stop; never self-selects. The HITL workhorse — automates retry-until-green while the human keeps the selection seat.
   - `ralph.sh --afk --prd N` — self-selects unblocked `ready-for-agent` children of PRD `N` (open issues whose `## Parent` references `#N`, all `## Blocked by` refs closed), grinds each, advances, and stops when none remain. The `--prd` arg keeps one-branch-one-feature intact; it may default from the branch name but explicit is the contract.

   Two guardrails against infinite running: a **per-issue attempt cap `K`** (tracked in `progress.md`, since cold restarts have no memory — at `K` cold attempts on the same issue without completion, flag it `ready-for-human` and stop/skip) and a **global iteration cap `MAX`** per run. A `Stop`-hook warm inner loop is explicitly **rejected for v1**: warm retries reintroduce context accumulation; cold restart is the whole point. Revisit only if per-fix re-reads prove measurably costly.

2. **Scope lives on GitHub, not in a `prd.json`.** The planning pipeline is **grill → `/to-prd` (parent PRD) → `/to-issues` (vertical slices)**. The `/to-issues` slice format already supplies everything Ralph needs: the **AFK/HITL** tag (unsupervised-eligibility), the `- [ ]` **acceptance-criteria** checkboxes (the "passes" field), and **Blocked-by** (priority/dependencies). A `prd.json` would duplicate this, drift from it, and forfeit `Closes #N` automation, triage labels, the issue↔PR↔commit graph, and the planning-gate review surface. The hand-built tracking-issue umbrella (ADR-0030) is superseded by the PRD-as-parent + child issues linked via the `Parent` field.

3. **Ephemeral progress in a gitignored `progress.md`.** The cold agent reads it first each iteration to resume cheaply instead of re-exploring; appends decisions, blockers, and changed files. It is never committed (the cold restart wipes the *context*, not the *filesystem* — `progress.md` + git history are the bridge). At feature end it is distilled into a GH comment via `/handoff` and deleted.

4. **The agent self-selects work.** Each iteration re-derives the worklist from *live* `gh` state and picks the highest-priority unblocked **AFK** slice. Self-selection (not a pre-frozen queue) is what makes the loop resilient to requirement changes mid-feature.

5. **The verifier is ungameable, because "green" must mean "done and honest."** This is what defeats the dominant agent failure — declaring a feature complete when it is not, or making a gate pass by lowering the bar.
   - **Commit hook (fast, blocking):** `lint` **+ a shortcut-detector** that fails the commit if the staged diff introduces `eslint-disable`, `@ts-ignore`, a stray `as any` (beyond the single commented exception CLAUDE.md pre-approves), `.skip`/`.only`/`xit`/`xdescribe`, or deleted assertions. Gaming a gate now turns a gate *red, at the moment of commit*.
   - **Push hook (blocking):** `test + build`. `build` is retained alongside `test` deliberately — web `test` (Vitest/esbuild) performs **no** type-checking and api `test` (Jest) type-checks only files tests import; `build` (`tsc && vite build` / `nest build`) is the whole-project typecheck gate. They are not redundant.
   - **TDD-first per slice:** acceptance criteria are encoded as tests *before* implementation, at the appropriate tier — Jest (logic), Storybook `play` (component interaction), Playwright (end-to-end flows). **Testability is the AFK/HITL boundary**: a criterion no automated check can express makes the slice HITL by definition.
   - **Verify before honouring the promise.** `<promise>COMPLETE</promise>` is necessary but not sufficient. The loop accepts completion only when the full gate is green *and* `gh` shows no unblocked AFK work remaining — cross-checked in bash so a hallucinated promise cannot strand real work and a crashed iteration cannot loop forever.

6. **No silent shortcuts — encoded in `PROMPT.md`, not just CLAUDE.md.** If the only path to green lowers the bar, the agent aborts the slice clean, resets the working tree, flags the issue `ready-for-human`, and records why in `progress.md`. Surfacing a blocker is the success condition. A genuinely-stuck slice that survives K cold attempts escalates to `ready-for-human` — the "hand off to the human" of ADR-0030, expressed as data.

7. **Docker sandbox is what licenses `--dangerously-skip-permissions`.** Unattended execution with skipped permissions is only acceptable inside a container that mounts the project directory read-write and nothing else. Auth is an injected `ANTHROPIC_API_KEY` env var — **never** a mounted `~/.claude` credential. Global `~/.claude` skills do not load in the sandbox; this is fine, because planning-time skills (`/to-prd`, `/to-issues`, `/handoff`) run *outside* the loop, and anything the loop genuinely needs is committed to in-repo `.claude/skills/`. The loop's behaviour lives in `PROMPT.md` + in-repo `CLAUDE.md`/`CONTEXT.md`/ADRs.

8. **Branch/PR model unchanged from ADR-0025/0030.** One feature branch per PRD; slices are commits (`Closes #N`); the agent opens the PR at COMPLETE (`--base main`); the human merges. Branch protection still forbids direct `main` pushes.

9. **Progression HITL → AFK (Ralph Tip 2) via the three rungs.** The same `PROMPT.md` drives all three modes. You climb the rungs as trust grows: `--once N` (watch a single pass) → `--issue N` (let it grind one issue to green while you still pick the issue) → `--afk --prd N` (unattended, in the Docker sandbox). The destination is bounded AFK, not overnight autonomy. `--issue` is the day-to-day HITL workhorse: it automates the toil while the human owns the risky judgement (which issue, is it really done).

10. **`PROMPT.md` vs `CLAUDE.md`.** `CLAUDE.md` is standing doctrine, auto-loaded into every session (interactive and loop). `PROMPT.md` is the loop's *driver* — mechanics (self-select, verify-before-promise, append progress) that would be noise or wrong in an interactive session. `PROMPT.md` references CLAUDE.md and never duplicates it. Loop-scoped experiments (e.g. an anti-entropy "fight entropy" altitude instruction) start in `PROMPT.md` so their blast radius is the loop alone; durable essence is promoted to `CLAUDE.md` only once proven.

11. **A dedicated entropy/refactor loop is deferred.** The "fight entropy" framing is trialled inside the feature loop's `PROMPT.md` first. A separate loop sourced from CodeScene hotspots (gated on tests-still-green **and** Code-Health-delta ≥ 0) is a later, separate decision. When built, it reconciles with ADR-0026 thus: ADR-0026 forbade auto-refactoring *welded onto every feature PR*; a deliberately-launched, bounded, branch-isolated, human-reviewed entropy run is ADR-0030's "refactoring as its own deliberate work" — executed by the loop instead of by hand. Human judgement still chooses *what* to refactor (ADR-0026's core claim); the loop only does the toil.

## Consequences

- **The hooks become real.** Implementing the ADR-0030 commit/push hooks (`lint` + shortcut-detector; `test + build`) is the first prerequisite slice of this work. Until then, ADR-0030's "deterministic gates (automated — do not run by hand)" describes automation that does not exist; CLAUDE.md is amended to flag this until the slice lands.
- **New artefacts:** `PROMPT.md`, `ralph.sh` (modes `--once N` / `--issue N` / `--afk --prd N`), the shortcut-detector script, a `Dockerfile`/compose for the sandbox, in-repo `.claude/skills/` as needed, and `.gitignore` entries (`progress.md`, `.playwright-cli/`).
- **ADR-0030 point 4 is reframed, not revoked:** "stop at every commit boundary and hand off" remains the rule for *interactive* sessions; AFK mode substitutes a cold-process restart for the human handoff, preserving the no-degrading-context principle.
- **ADR-0030's tracking-issue umbrella is superseded** by `/to-prd` parent + `/to-issues` children.
- **Reversible with churn:** the loop is external and additive; the hooks, sandbox, and prompts can be removed without touching application code. The planning pipeline change (to-prd → to-issues) is the stickiest part.
- **Chromatic is not adopted** as a verifier tier (not yet implemented); Playwright covers end-to-end/visual acceptance.
