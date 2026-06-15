# ADR-0045 — Ralph: agent autonomy over loop machinery; CI is the sole ungameable gate

## Status

Accepted (2026-06-15). **Supersedes parts of ADR-0040:** §4 (bash-filtered selection), §5 (bash-side gate cross-check / `loop-decision`), §9 (three trust rungs), and the 2026-06-15 amendment's *in-iteration gate-gap* mechanism. Builds on ADR-0040 (cold-restart loop), ADR-0030 (deterministic gates), and is informed by Geoffrey Huntley's and Matt Pocock's published Ralph implementations.

## Context

ADR-0040 shipped a working loop, but it grew to a **576-line `ralph.sh` + 125-line `PROMPT.md`**. Almost every line of that machinery exists for one reason: **bash does not trust the agent's judgement.** So bash filtered eligibility (`list_eligible` parsing `## Parent` / `## Blocked by` / attempts / closing-commits), re-ran the gate (`run_gate`), adjudicated the completion promise (`loop-decision.mjs`), tracked per-issue attempts (`K`, stored in `progress.md`), and detected stalls.

Two production bugs emerged, and **both are the same failure**: *drift between bash's model of reality and actual reality.*

- **False-PRD-completion:** `run_afk` called the PRD complete whenever `list_eligible` was empty — but that only counted `ready-for-agent` issues, so it went empty while `ready-for-human`/blocked slices remained. "No work I can pick up" was conflated with "PRD done."
- **Gate-blindness:** an iteration declared a slice done while the workspace gate was red, because it reasoned from `progress.md` narrative + git state and never re-ran the gate. `progress.md` had drifted from the truth.

Studying Matt Pocock's Ralph (~70 lines total) surfaced the structural lesson: he pushes *judgement into the agent* and lets **artifacts** (commits + issue state) be the only state. The cold restart rebuilds reality from artifacts every iteration, so there is almost nothing to drift. His loop has no `progress.md` (state = `git log` + issue files), no bash gate (the agent runs its own feedback loop), and treats HITL as simply *visible-but-not-worked*.

The decisive realisation for us: **the genuinely ungameable verifier was never `ralph.sh`'s `run_gate`.** It is the **CI required check + human-only merge** — server-side, no bypass actors, auto-merge off. A red branch *cannot* reach `main`. `run_gate` and `loop-decision.mjs` were belt-and-braces over a mechanism that already cannot be gamed. (Verified 2026-06-15: ruleset "Protect Main" is active, requires the aggregate `CI` check — `needs: [lint, test, build]` — with zero bypass actors; `allow_auto_merge: false`; the user merges manually.)

This ADR records the resulting pivot: **autonomy over machinery.** It is *not* a retreat from ADR-0040's "ungameable gate" thesis — it relocates the gate to where it is actually unbypassable (CI) and deletes the bash that duplicated it.

## Decision

### 1. CI is the sole ungameable gate; bash leaves the verification business

Delete `run_gate` and `loop-decision.mjs`. Verification rests on **three layers, one guarantee**:

| Layer | Ungameable? | Role |
|---|---|---|
| **CI required check + human-only merge** (ruleset, no bypass) | **Yes — server-side** | The gate. Red never reaches `main`. |
| Local `.githooks` (commit/push) | **No** — the agent runs `--dangerously-skip-permissions`; there is no `--no-verify` detection | Fast local mirror; catches most red early |
| Agent's own `test` + `tsc --noEmit` before commit | No — trust-based | Efficiency: avoid a known-red commit |

"Verify before honouring the promise" (ADR-0040 §5) still holds — but the verifier becomes the **push hook + CI**, not a bash re-run. A dishonest promise produces a PR that fails CI: *visible*, never silent corruption. This is a *stronger* guarantee than `ralph.sh`'s local `run_gate`.

### 2. `progress.md` is killed; `K` is dropped

`progress.md` carried three payloads; each is reassigned:

- **Narrative memory** → **commit messages.** Adopt the convention that every commit body carries *key decisions* + *blockers/notes for the next iteration*. The cold restart reads `git log -n N` instead of a scratchpad. Because the commit is the artifact, it cannot drift from reality.
- **The `attempts_N` / `K` counter** → **deleted.** Only the global `MAX` iteration cap remains, as a pure runaway-stop. Per-issue `K` was machinery ahead of data: on a single-issue grind `K` *is* `MAX` (3 failures of 6 and it isn't moving on regardless), and a hard cap removes the agent's autonomy to work out *why* it is stuck and pivot. If retry-thrashing proves real in monitoring, re-derive a cap from `gh`/`git` then.
- **Truncation-resume signal** → **the last commit is the resume point.** A `--max-turns`/crash cut before commit is simply redone next iteration. No `result=` plumbing.

### 3. The invariant: `gh` is the state machine, `git log` is only memory

**Doneness is never inferred from commit content.** Issue **labels and state** are the loop's state machine; `git log` is narrative memory only. A `Closes #N` commit reverts to pure GitHub merge-automation that *nothing in the loop reads*. This is what makes the reject channel (§6) consistent: a rejected slice's `Closes` commit persists in history, so any commit-based doneness check would lie — only the label tells the truth.

### 4. bash gathers, the agent judges

Each iteration bash does one cheap `gh` query — dump the PRD's children (number, title, body, labels, open/closed) — plus `git log -n N` (full bodies) plus `PROMPT.md` plus the runbook (§8). That is the whole injected context. `list_eligible`'s eligibility parsing is deleted; the agent reads the blockers and the commit log and **self-selects** the highest-priority unblocked `ready-for-agent` issue.

### 5. HITL is visible — "Not Ralph"

All PRD children appear in the candidate corpus, including HITL ones, tagged. The prompt says *work `ready-for-agent` only; never `ready-for-human`.* The agent sees HITL issues for dependency context but will not work them.

**Two distinct terminal signals — this is the fix for the false-PRD-completion bug.** Seeing everything is necessary but not sufficient: the agent must also *communicate* which terminal state it is in, or bash mis-announces. So it emits one of two tokens, and bash routes on them (it never recounts — the agent judges):

- `<promise>NO MORE TASKS</promise>` — **every** slice is delivered (closed or `ready-for-review`), nothing open. → `finish_run`: open the PR, announce COMPLETE.
- `<promise>HANDOFF — N need a human</promise>` — no `ready-for-agent` work remains, but open HITL/blocked slices do. → **stop and notify "N slices need a human"; do NOT open the PR or announce completion.**

This matters because a PRD with any HITL slice **can never reach true COMPLETE** under the loop (HITL issues stay open until a human acts) — so `HANDOFF` is the *normal* terminal for any mixed PRD, and conflating it with `NO MORE TASKS` is exactly the original bug. (The distinction is moot in `once` — no `finish_run` — but load-bearing in `afk`.)

### 6. The reject channel is a label

Ralph cannot *close* an issue — `Closes #N` only fires at PR merge, which is the human. So issue open/closed cannot be Ralph's doneness marker, and (per §3) neither can the commit. The **label** is:

- Agent finishes a slice → commits `Closes #N` **and relabels** `ready-for-agent` → **`ready-for-review`**.
- **Selection** ignores `ready-for-review` (done, awaiting a human) and `ready-for-human` (HITL).
- **Blocker-satisfaction** uses the same signal: a `## Blocked by` ref is satisfied when that issue is **closed OR labelled `ready-for-review`** — never "has a `Closes` commit."
- Human **accepts** → does nothing; the slice rides the branch and merges. Human **rejects** → flips the label back to `ready-for-agent` and appends a `## Rework — <why>` note. The next cold iteration re-picks it and reads the note. (Cold restart has no memory, so the reason *must* become an artifact: the note is that artifact.)

This is the GitHub-native analog of moving a file out of a `done/` folder — the lightest possible durable state, ratified against the commit and owned by the human on the reject flip.

### 7. Two entry points; pinning dropped

Collapse the three selection-and-stop policies to two that differ only in iteration count + supervision:

- **`once --prd N`** — one iteration, watched (no sandbox, `acceptEdits`). The near-term issue-by-issue driver: it self-selects the top unblocked issue, the human reviews, runs it again.
- **`afk --prd N`** — N iterations, sandboxed, stops on the completion promise.

`--issue N` **pinning is dropped** — it bypassed self-selection, working against the autonomy this ADR establishes. Control of *which* issue is exercised through **board state** (labels), not a flag. `--prd N` stays: it scopes selection to one feature, keeping one-branch-one-PR intact (ADR-0040 §2).

### 8. Operational learning capture — `docs/agents/ralph-runbook.md`

A **committed**, auto-injected file the agent may append **operational facts** to (via a sub-agent, kept brief) when it learns something non-obvious the hard way — e.g. the correct single-test command after running the wrong one several times. Guardrails: operational facts only (self-verifying — a wrong command just fails); never duplicate what `CLAUDE.md` already states; brief; the human prunes/promotes at PR review.

This is the **one self-edited durable file we deliberately re-admit** after killing `progress.md`. The distinction is principled:

| | `progress.md` (killed) | `ralph-runbook.md` (admitted) |
|---|---|---|
| Tracking | gitignored | committed (PR-reviewed) |
| Content | unverifiable narrative state | self-verifying operational facts |
| Loop dependence | the loop's *correctness* depended on it | efficiency aid only — wrong/empty, the loop still works |

**Secondary purpose — an instrument.** Whether Ralph writes to the runbook, and whether the entries are crisp or junk, is a live proxy for whether the prompt's "help your future self" driver is landing. We *want* that signal.

### 9. Loop-back directives in the prompt

"Loop back is everything" is already the macro-spine (cold restart reading `git log`; commit-body-carries-blockers; TDD). Three cheap *within-iteration* loop-backs are added:

- **Leave it better than you found it** — the entropy-in-passing trial (ADR-0040 §10), retained.
- **Self-evaluation before commit** — re-read the diff against the acceptance criteria via a sub-agent prompted to *find the bug you just wrote*, and fix it before committing. This relocates the verification deleted from bash (§1) into the agent, where the judgement lives.
- **Instrumentation permission** — add logging or a throwaway test freely to debug; run it, read the actual output, iterate.

### Definitions (corrects ADR-0040 §5)

ADR-0040 §5 said "testability is the AFK/HITL boundary." That is **too narrow** — the migration slices (#428/#430/#433) are testable yet human-gated. Corrected:

- **AFK** (`ready-for-agent`) — *all* acceptance criteria are machine-verifiable, and the work carries no action a human must authorise. The loop can take it end to end.
- **HITL** (`ready-for-human`) — completing it *in full* needs human sign-off: **either** a criterion no automated check can express, **or** an irreversible/risky action (a DB migration, a destructive change) a human must authorise — even when that action is itself testable.

## Alternatives considered

- **Keep `run_gate`/`loop-decision` as belt-and-braces.** Rejected: they duplicate CI (the real gate) and are the surface two drift bugs lived on. Redundancy that *causes* bugs is not safety.
- **Keep a lightweight per-issue `K`** derived from commits. Rejected for now: needs reconstructed state, removes pivot-autonomy, and `MAX` already bounds runaway. Data-gated for later.
- **Reject channel via `git revert` / PR request-changes only.** Rejected: a reverted slice's `Closes #N` persists in history (defeats commit-based doneness), and PR-only review loses the in-run flip-back the label gives.
- **Let the agent self-edit `CLAUDE.md` ("take itself to university").** Rejected: `CLAUDE.md` is human-owned doctrine; auto-editing it risks doctrine drift. The runbook is the bounded, operational-only alternative.
- **A `fix_plan.md` for discovered work.** Rejected: already covered, better, by spin-off-to-`gh issue` (real tracker, `Closes #N`, labels, PR graph). The issue *is* the fix-plan entry.
- **Keep `--issue N` pinning as an escape hatch.** Rejected from the main path: board state expresses the same intent without bypassing self-selection.

## Consequences

- **Load-bearing precondition — the trust model depends on the ruleset.** If anyone adds a bypass actor to "Protect Main", makes the `CI` check optional, or enables auto-merge, the gate silently becomes hollow. This must be stated wherever the loop is operated.
- **Process rule — humans must close or label HITL issues they finish.** Blocker-satisfaction reads `closed` OR `ready-for-review`; a human who completes a HITL blocker but leaves it `ready-for-human` will leave its dependants wrongly blocked.
- **Slices must stay tracer-small.** With incremental `progress.md` *and* `K` both gone, an oversized slice cut by `--max-turns` before it commits is redone from clean `HEAD` every iteration — a single too-big slice can burn the whole run with zero committed progress. `MAX` is the only floor. This is now a hard planning-time dependency, not just a preference.
- **Per-slice reject is a `once`-mode affordance.** In `afk`, `finish_run` opens one squash PR for the whole branch, so review there is PR-granular; the label flip-back only helps on a *subsequent* run. (Fine — the near-term mode is `once`.)
- **Working-tree hygiene moves to bash.** Old PROMPT step-7's `git reset --hard && git clean -fd` (abort cleanup) is gone, but the passthrough mount means a dirty tree survives a cold restart. `ralph.sh` runs `git reset --hard && git clean -fd` at the **start of each iteration** so a truncated/aborted iteration never poisons the next.
- **New label `ready-for-review`** is added to the triage vocabulary (`docs/agents/triage-labels.md`).
- **CI loses a step:** `ci.yml` runs `loop-decision.test.mjs`; that step is removed with the module.
- **Observability is retained, deliberately.** `ralph-stream.mjs` (live feed + metrics), the `ralph.log` heartbeat, and the webhook are *instrumentation, not verification machinery* — they do not duplicate CI and they keep an unattended `afk` run debuggable. The simplification target is the trust machinery, not the instruments. **One adjustment:** dropping `<selected>N</selected>` removes the heartbeat's per-issue tag, so the heartbeat reads which issue was worked from the iteration's `Closes #N` commit instead. `finish_run`'s terminal message must distinguish COMPLETE from HANDOFF (§5); the PR opens only on true COMPLETE.
- **`PROMPT.md` drops from ~125 to ~45 lines** (target in the appendix); `ralph.sh` loses `list_eligible`, `run_gate`, `loop-decision`, the `attempts_*` helpers, and one of three mode runners.

## Implementation

Out of scope for this ADR (a docs change). The code is its own sliced work on a fresh branch off `main`, planned via `/to-prd` → `/to-issues`: slim `ralph.sh`, rewrite `PROMPT.md` (appendix), delete `loop-decision.mjs` + its test + the CI step, create the `ready-for-review` label, scaffold `ralph-runbook.md`, and add the start-of-iteration tree-reset.

## Appendix — target `PROMPT.md`

```markdown
# Ralph — one cold iteration

You are one cold iteration of GigMan's agent loop. Your context starts empty.
Standing doctrine lives in CLAUDE.md (auto-loaded), CONTEXT.md, and docs/adr/ —
read them; this file never repeats them. It is just the loop's driver.

You are handed, below this prompt:
- **Recent commits** (git log) — your ONLY narrative memory across restarts. Read
  the bodies for decisions and blockers the last iteration left you.
- **The runbook** (docs/agents/ralph-runbook.md) — operational know-how earlier
  iterations discovered. Trust it; add to it (see step 5).
- **The PRD's open issues** — your candidate work.

## Your iteration

1. **Select.** Pick the highest-priority UNBLOCKED issue labelled `ready-for-agent`.
   NEVER touch `ready-for-human` (HITL) or `ready-for-review` (done, awaiting a
   human). Priority: **a slice flipped back with a `## Rework` note (a human is
   waiting on it) → critical bugfix → infra/tests/types → tracer-bullet feature
   slice → polish → refactor.** A `## Blocked by` ref is satisfied when that issue is
   closed OR labelled `ready-for-review`. Work exactly ONE issue.
   If no `ready-for-agent` work remains, stop with the right signal:
   - `<promise>NO MORE TASKS</promise>` if EVERY slice is delivered (closed or
     `ready-for-review`);
   - `<promise>HANDOFF — N need a human</promise>` if open HITL/blocked slices remain.

2. **Test first (TDD, ADR-0024).** Encode the acceptance criteria as tests before
   implementing. A criterion no automated test can express makes the issue HITL —
   relabel it `ready-for-human` with a one-line why, and stop.

3. **Implement to green**, following CLAUDE.md. Search before you build; reuse. Ship
   the full slice — no stubs. Keep it tracer-small: a slice too big to finish in one
   iteration risks being cut before it commits, losing all its work. Add logging or a
   throwaway test freely to debug — run it, read the actual output, iterate. While
   you are in a file, take the small, safe, in-scope improvement the tests you are
   already running cover (a clearer name, a dead branch) — never a detour into files
   this slice does not touch.

4. **Spin off, don't expand.** Work you uncover becomes its own `gh issue`
   (`ready-for-agent` if corrective/structural; `needs-triage` if new scope) — never
   folded into this commit.

5. **Feedback loop, then commit.** Run `test` + `tsc --noEmit`. Then re-read your own
   diff against the issue's acceptance criteria — a sub-agent, prompted to find the
   bug you just wrote — and fix what it finds. One commit, Conventional Commits,
   `Closes #N`, body carrying **key decisions + blockers for the next iteration**
   (this is the loop's memory — there is no progress.md). Then relabel the issue
   `ready-for-agent` → `ready-for-review`. If you learned an operational fact the hard
   way (the right command after wrong ones), add it briefly to the runbook via a
   sub-agent.

6. **No silent shortcuts.** If the only path to green lowers the bar (eslint-disable,
   `as any` to dodge types, a weakened/skipped test, a stub), don't take it. Relabel
   `ready-for-human` with why, and stop. Surfacing a blocker is the success condition.

## Sub-agents
Parallelise read-only exploration freely. NEVER run build or tests in more than one
sub-agent — validation must be serial, or concurrent runs produce false failures.
```
