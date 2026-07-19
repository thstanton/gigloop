---
name: fleet-claim
description: Claim and implement a GitHub issue as a concurrent fleet session, following the surface-disjoint claim protocol in docs/agents/fleet.md. Use when a session is dispatched to a specific issue — opened in an auto-created git worktree (`claude --worktree`) or with a bare issue reference like `691` — before writing any code. Handles branch-name normalisation, the claimability precheck (surface disjointness, WIP cap, schema lock), posting the in-progress claim, then building from the issue's agent brief.
---

# Fleet claim

Runs at the **start of a dispatched fleet session**, before any code. Turns a bare
issue dispatch into a claimed, convention-named, ready-to-build session. Full
rationale: `docs/agents/fleet.md`.

## Input

The issue number to work — from the dispatch prompt (a bare `691`) or, if absent,
ask the human which issue. **Never self-select an issue:** which issue a session
works is the human's dispatch decision.

## Steps

1. **Normalise the branch.** `claude --worktree` lands you on a random
   `worktree-<name>` branch. Rename it to the convention:
   - Type prefix from the issue's category label — `bug` → `fix/`, `enhancement` → `feat/`.
   - Slug: if the branch is `worktree-<issue>-<words>`, strip `worktree-` and keep
     `<issue>-<words>`; if it's just `worktree-<issue>`, derive a short kebab slug
     from the issue title.
   - `git branch -m <type>/<issue>-<slug>`
   - **Idempotent:** if already on a `fix/…` or `feat/…` branch, skip.

2. **Run the claimability precheck:** `scripts/claimability.sh <issue>` (bundled).
   It prints the in-flight map, each issue's declared Surfaces, and a
   `VERDICT: CLAIMABLE | BLOCKED`. Surface parsing is heuristic —
   **sanity-check it against the codebase**, and re-validate this issue's Surfaces
   (declared at planning time, they may have staled).

3. **Decide:**
   - `BLOCKED`, or any doubt on your own read → **stop and tell the human.** Do not
     code on an overlapping surface; do not silently pick a different issue.
     Surfacing the block is a success, not a failure.
   - `CLAIMABLE` → continue.

4. **Claim** (skip if the issue is already `in-progress` and assigned to you):
   - `gh issue edit <issue> --remove-label ready-for-agent --add-label in-progress`
   - `gh issue edit <issue> --add-assignee @me`
   - Comment: the branch, the worktree path (`git worktree list`), and the
     claimability summary. Prefix AI-posted comments with
     `> *AI-posted fleet claim (docs/agents/fleet.md).*`

5. **Bootstrap the worktree** (new worktree only, before the first build step):
   `bun install` then `npx prisma generate -w apps/api`. A worktree does not
   inherit the main checkout's install artefacts, and the unit tests pass
   without them — so a skipped bootstrap surfaces later as a Storybook `/@fs/`
   resolution failure, not here. See `docs/agents/fleet.md` → *Worktree bootstrap*.

6. **Build** from the issue's `## Agent Brief` comment, following `CLAUDE.md` — one
   commit per (sub-)issue, checkpoint per the session-stop rules. If mid-build you
   need an undeclared surface, treat it like a BLOCK: stop, flag the overlap, and
   record the widened surface on the issue.

   **Spot something out of scope?** A bug or refactor target beyond your claimed
   surface → **file a `needs-triage` issue and keep building** (no permission
   needed; dedup against open issues + `.out-of-scope/` first; note it was
   surfaced while working this issue). Don't detour to fix it, don't drop it.
   See `docs/agents/fleet.md` → *Stewardship*.

## Not this skill's job

Choosing *which* issues to dispatch (the human's surface-disjoint call), merging
(human-only, batched merge window), and rebasing after a sibling merges (a separate pass).
See `docs/agents/fleet.md`.
