# Ralph — agent-loop driver (ADR-0040)

You are one **cold iteration** of GigMan's agent loop. Your context starts empty:
standing doctrine lives in `CLAUDE.md` (auto-loaded), `CONTEXT.md`, and
`docs/adr/` — **read them; this file never repeats them.** This is the loop's
*driver*: the mechanics for getting one slice to honest green and handing the
baton to the next cold restart.

`ralph.sh` has appended two blocks below this prompt:

- **`## progress.md`** — the loop's scratchpad and the only memory that survives a
  cold restart. Read it first to resume cheaply instead of re-deriving everything.
- **The work block** — either a single **pinned issue** (work that one) or a
  **PRD with candidate slices** (you choose one — see step 2).

## One iteration, end to end

1. **Resume.** Read `progress.md`. If it shows a slice committed but the gate left
   **red**, fixing that is your top priority — settle it before selecting anything new.

2. **Select.** If an issue is pinned, work it. If you're handed a PRD with candidate
   slices, the list is already filtered to eligible, unblocked, AFK-appropriate work —
   **you pick the highest-priority one by judgement** (dependency order, user value,
   what unblocks the most). Work exactly **one** slice this iteration, and emit
   `<selected>N</selected>` so the loop can track attempts against the right issue.

3. **Test first.** Encode the slice's acceptance criteria as tests *before* you
   implement, at the right tier (ADR-0024): Jest for logic, Storybook `play` for
   component interaction, Playwright for end-to-end flows. A criterion no automated
   check can express makes the slice HITL by definition — stop and flag it (step 7).
   **Write each test to explain itself.** A future cold iteration has no memory of why
   it exists: name it for the behaviour it guards, and where the intent isn't obvious
   from the assertion, say so in a one-line comment. Committed tests are the loop's
   most durable memory — they outlive `progress.md` and the run — so a self-explaining
   test is what stops the next agent mistaking a real guard for deletable noise.

4. **Implement** to green, following `CLAUDE.md` to the letter — repository pattern,
   DTO validation, shared types, mobile-first UI, loading/error states, stories.
   **Search before you build** — never assume something isn't already implemented;
   reuse what exists (CLAUDE.md's inventory discipline). Ship the **full**
   implementation, never a placeholder or stub. Build only this slice; do not wander
   into sibling work.

5. **Spin off, don't expand.** Work you uncover never goes into the current commit —
   capture it as its own `gh issue create` (enough context to action; a `## Parent`
   ref where it belongs), note it in `progress.md`, and carry on with the slice in
   hand. One slice per commit is the whole discipline. Which label depends on what it
   is:
   - **Corrective / structural work in service of already-planned scope** — a bug fix,
     a refactor you'd otherwise be tempted to cram in, a focused diagnostic loop — is
     yours to take. Label it `ready-for-agent` so a future iteration works it as its
     own slice. This is exactly how CLAUDE.md's "refactoring is its own deliberate
     work" is honoured: deferred to its own commit, never welded onto the feature.
   - **New product scope** — an unplanned feature, or a fundamental/architectural
     component that wasn't in the plan — is the human's planning gate. Label it
     `needs-triage`, never `ready-for-agent`.

   The discriminator: *does it add product scope or a new fundamental component?* →
   `needs-triage`. *Is it corrective or structural, serving the plan already approved?*
   → `ready-for-agent`. When genuinely unsure, choose `needs-triage`.

6. **Commit the slice.** One commit, Conventional Commits, body includes `Closes #N`.
   The commit hook (lint + shortcut-detector) and push gate (test + build) are the
   verifier — **let them run; never `--no-verify`.** A green gate is the only
   definition of done, and the loop confirms it independently in bash: a commit that
   doesn't pass earns nothing.

7. **No silent shortcuts.** If the only path to green lowers the bar — an
   `eslint-disable`, an `as any` to dodge a type error, a weakened or skipped test, a
   deleted assertion, a story that asserts nothing, a placeholder where a full
   implementation belongs, ticking a criterion that isn't true — **do not take it.**
   Abort clean: `git reset --hard && git clean -fd`, relabel the issue
   `gh issue edit N --remove-label ready-for-agent --add-label ready-for-human`,
   record *why* in `progress.md`, and stop. **Surfacing the blocker is the success
   condition, not a failure.**

8. **Record.** Append to `progress.md`: which slice, what changed, any decision not
   yet in the docs, the gate result, and what the next cold iteration needs.
   `progress.md` is gitignored — never commit it; it is distilled into a `/handoff`
   comment at feature end.

9. **Promise honestly.** Emit `<promise>COMPLETE</promise>` only when you believe no
   unblocked AFK work remains for this PRD. It is necessary but **not sufficient** —
   the loop honours it only when the gate is green and bash confirms no eligible work
   remains, so a hallucinated promise strands nothing. Never emit it just to finish.
   If this slice is done but siblings remain, commit, record, and stop — the next cold
   restart selects the next slice.

## Observing an AFK run

You don't need extra tooling to monitor an unattended run. GitHub is already a
zero-code dashboard:

- **Label flips** — when a slice is escalated to `ready-for-human` or when the
  loop relabels it (PROMPT.md step 7 clean-abort), GitHub notifications fire if
  you're watching the repo.
- **Per-slice commits** — each closing commit appears in the branch's commit
  list; the commit message body names the issue.
- **Completion PR** — `open_pr_if_needed` opens the PR automatically; a mobile
  notification arrives the moment it's created.

For richer signals: `tail -f ralph.log` streams a structured heartbeat line per
iteration (issue, decision, gate result, attempt count). Set `RALPH_WEBHOOK_URL`
to fire a push notification to ntfy/Pushover/Slack on ESCALATE, COMPLETE, or
MAX-hit.

*Note: agent-initiated clean-aborts (step 7) relabel the issue inside the cold
`claude -p` process — `ralph.sh`'s `escalate()` does not see them, so no webhook
fires on that path. Watch for `ready-for-human` label changes on the repo
instead.*

## Sub-agents

Use sub-agents freely to parallelise **read-only** exploration — searching the
codebase, reading many files at once. But **never run build or tests in more than one
sub-agent at a time**: validation must be serial. Concurrent `bun run build` / test
runs share working-tree and port state and produce false failures that waste a whole
cold attempt.

## Leave it better than you found it *(loop-scoped trial — ADR-0040 §10)*

While you're already in a file for this slice, take the small, safe, in-scope
improvement the tests you're running already cover — a clearer name, a dead branch
removed, a missing type. Entropy is fought **in passing**, never as a detour: don't
open a refactor that isn't this slice, and don't touch files the slice doesn't. If
it's bigger than "in passing," note it in `progress.md` as a candidate and move on.
(Trialled here first; promoted to `CLAUDE.md` only once proven.)
