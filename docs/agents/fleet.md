# Fleet — concurrent interactive sessions

How several **interactive (HITL) Claude Code sessions** work the backlog simultaneously without treading on each other. This is not Ralph: the AFK loop (ADR-0040/0045) is on ice. But the fleet deliberately runs on the same substrate the loop used — **GitHub labels are the state machine; there is no side-channel coordination state** — so the conventions here transfer if the loop returns.

The human dispatches: they decide when to open a session and on what. Everything below exists so that dispatching, and running three sessions at once, costs the human almost no attention.

## The rules at a glance

| Rule | Value |
| --- | --- |
| Concurrency | Sessions run in parallel only on issues with **disjoint Surfaces** |
| Schema lock | At most **one** in-flight PR may touch `prisma/schema` / migrations |
| WIP cap | **3** concurrent implementation sessions / unmerged implementation PRs |
| Claim token | `in-progress` label + assignee + branch/worktree comment |
| Merging | **Daily merge window**, batched; only the human merges |
| Conflicts | **An agent rebases — never the human.** |
| Workspace | One git worktree per session (`gigman-<issue>` pattern) |

"Surfaces" are the modules an issue expects to touch, declared on the issue at planning time (see `issue-authoring.md` §8). Disjoint-by-construction parallelism is the whole trick: conflicts are prevented at planning, when attention is cheap, not resolved at merge, when it is scarce.

## Claim protocol (first act of every implementation session)

Before writing any code:

1. **Read the in-flight set** — all open issues labelled `in-progress` — and their declared Surfaces.
2. **Verify claimability:** the target issue's Surfaces are disjoint from every in-flight claim; the WIP cap (count of `in-progress`) has a free slot; the schema lock is free if this issue touches schema. Re-validate the declared Surfaces against the current codebase while you're at it — they were declared at planning time and may have staled.
3. **Claim:** swap `ready-for-agent` → `in-progress`, self-assign, and comment the branch and worktree being used.
4. If any check fails, **stop and tell the human** — do not start coding on an overlapping surface, and do not silently pick a different issue.

If mid-build work turns out to need a surface that wasn't declared, treat it exactly like step 4: stop, flag the overlap to the human, and record the widened surface on the issue.

**Stale claims:** an `in-progress` issue whose branch has gone quiet is visible by construction (label + branch comment). The human un-claims it (label back to `ready-for-agent`); nothing else needs cleanup.

## Merge window (daily)

PRs are merged in **one daily sitting**, not as they land. Between windows, sessions keep filling free slots — nobody waits on a merge.

- The human reviews and merges the batch in whatever order they like.
- If a merge conflicts a sibling PR, an agent gets a **rebase pass** before the next window. The human never resolves a conflict by hand.
- A PR that would go semantically stale (a sibling changed its assumptions) is flagged during its rebase pass, not discovered on preprod.

## Attention protocol — front-load, then dark to the checkpoint

A session's demand on the human is concentrated at its **ends**:

- **Claim time:** the session presents its reading of the agent brief, the surface check, and its plan — one approval exchange.
- **Checkpoint time:** commit done, deviations from the brief summarised (and flagged on the PR, per existing convention).

Between those, the session runs autonomously. **A mid-build question is a defect in the brief.** When one genuinely can't be avoided, the answer is *written back onto the issue* — so the decision is durable and the brief's gap is patched — never just spoken into the session. The only legitimate mid-build stops are: a discovered surface overlap, a Hard Rule / CONTEXT.md contradiction (CLAUDE.md already mandates flagging those), or a design fork that triage should have escalated.

## Batch triage (feeding the fleet)

The pipeline starves without a stock of claimable issues, so triage runs in batches. The generic `/triage` skill is the engine, untouched; the repo-side convention is:

1. **Fan out** the investigation: one sub-agent per `needs-triage` issue, each returning a draft verdict (`ready-for-agent` / `needs-info` / `wontfix` / **escalate to grill**), a draft agent brief, and proposed Surfaces.
2. **Rapid-fire sitting:** the human approves/vetoes pre-baked verdicts, not raw issues.
3. **Auto-escalation is a bright line** (see `issue-authoring.md`): anything touching schema, a lifecycle/state machine, or cross-feature behaviour cannot be batch-approved to `ready-for-agent` — it goes to a full `/grill-with-docs`.

## Why it's shaped this way

- **Self-claim over a dispatcher.** A dispatcher process holds a private model of what's running — exactly the drift disease ADR-0045 diagnosed in `ralph.sh`. Labels + assignees drift from nothing; any session (or the human, from a phone) can read the whole in-flight map from GitHub.
- **Declared surfaces over optimistic merging.** Optimistic concurrency surfaces conflicts at merge/preprod time, where the human's attention is the scarce resource. Surface declaration costs ~nothing at grilling (the files are already under discussion) and makes the parallel-safety decision mechanical. Proven in practice before it was named: #713/#714, #715/#716, #725/#726/#727 were all built concurrently as disjoint sets and merged cleanly in arbitrary order.
- **WIP cap 3, derived from review bandwidth, not agent capacity.** Every PR crosses the human's desk; batches of 2–3 have been absorbed comfortably in one sitting, and beyond that queue-time (and staleness risk) grows faster than throughput.
- **The schema lock.** Migration ordering under squash-merge is the one conflict class that is structurally nasty rather than textually trivial — two parallel migration folders can both pass CI and still be wrong when sequenced. One-at-a-time is cheaper than any clever fix.
- **No ADR.** This is workflow/ops, not architecture — nothing in the running system knows these rules exist. If the fleet model ever starts governing autonomous machinery again (Ralph revived), that's the moment it graduates to an ADR.
