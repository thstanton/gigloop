#!/usr/bin/env bash
# ralph.sh — cold-restart AFK loop (ADR-0040, ADR-0045)
#
# Usage:
#   ./ralph.sh --once --prd N   one cold pass over PRD #N; the agent self-selects a
#                               slice, you are the loop (watched HITL pass)
#   ./ralph.sh --afk --prd N    self-select + grind unblocked AFK children of PRD #N
#
# ADR-0045: bash GATHERS, the agent JUDGES. ralph.sh no longer filters eligibility —
# it injects the candidate corpus (the PRD's open children + git log + runbook) and the
# agent self-selects the highest-priority unblocked `ready-for-agent` slice, works it,
# self-verifies, commits `Closes #N`, and relabels it `ready-for-review`. There is no
# `<selected>` marker, no `--issue` pinning, and no bash blocker/attempts parsing.
#
# Env:
#   RALPH_MAX=20           global iteration cap per run (default 20)
#   RALPH_LOG_N=15         how many recent commits (full bodies) to inject (default 15)
#   RALPH_STALL=2          consecutive NO-SELECTION iterations before a clean stall
#                          (afk mode; default 2)
#   RALPH_UNSAFE=1         run inside Docker Sandbox + --dangerously-skip-permissions
#   RALPH_WEBHOOK_URL=url  POST target for ESCALATE/COMPLETE/STALL/MAX-HIT events (optional)
#
# Sandbox one-time setup (RALPH_UNSAFE=1, ADR-0040 §7):
#   1. sbx secret set-custom -g --host api.anthropic.com \
#        --env CLAUDE_CODE_OAUTH_TOKEN --value "$CLAUDE_CODE_OAUTH_TOKEN"
#   2. sbx policy set balanced   (allows Anthropic, GitHub, package registries)
#   Mounts the repo as a direct RW passthrough — do NOT use --clone.
#   Verified: sandbox cannot read ~/.ssh or ~/.claude; .claude/skills/ available.
#
# Observing an AFK run (no extra tooling required):
#   GitHub mobile is the zero-code dashboard — watch for ready-for-human label
#   flips, per-slice commits on the branch, and the completion PR notification.
#   For richer signals: `tail -f ralph.log` (one structured line per iteration);
#   set RALPH_WEBHOOK_URL to push-notify on ESCALATE/COMPLETE/STALL/MAX-HIT.
#   Terminal events: COMPLETE (all work delivered), COMPLETE-LOCAL (delivered but the
#   sandbox couldn't push — branch is committed, push + open the PR by hand), STALL
#   (agent declined listed work RALPH_STALL times — needs a human), MAX-HIT, ESCALATE.
#   Note: agent clean-aborts (PROMPT.md step 7) relabel the issue inside the
#   cold claude process — ralph.sh's escalate() never sees them, so no webhook
#   fires on that path. Watch for ready-for-human label changes on the repo.

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
PROMPT_FILE="$ROOT/PROMPT.md"
PROGRESS="$ROOT/progress.md"
LOG="$ROOT/ralph.log"
RUNLOG_DIR="$ROOT/logs"           # per-iteration raw stream dumps + metrics (gitignored)
CURRENT="$ROOT/ralph.current"     # live status snapshot, rewritten per stream event (gitignored)
K="${RALPH_K:-3}"
MAX="${RALPH_MAX:-20}"
STALL="${RALPH_STALL:-2}"
# RALPH_MAX_TURNS / RALPH_MAX_USD (both optional, both unset = no cap, behaviour
# unchanged): per-iteration ceilings passed to `claude --max-turns` / `--max-budget-usd`.
# Either one ENFORCES the cold-restart handoff (ADR-0040): a capped iteration ends
# (result subtype `error_max_turns` for the turn cap), progress.md carries state, the
# next cold restart resumes. `--max-turns` is functional in this CLI (v2.1.177) though
# it is absent from `claude --help`. Set the cap ABOVE a healthy slice's measured
# turns= / cost= (now in every heartbeat) — too low and every iteration is cut
# mid-slice, fails the gate, and burns a K attempt. A rot-ceiling, not a speed dial.

# Per-iteration stream artefact paths — set fresh in cold_pass, read back for the
# heartbeat. run_cold runs in a `$(...)` subshell that inherits these; the FILES the
# formatter writes persist beyond it.
RUN_JSONL=""
RUN_METRICS=""
RUN_CLAUDE_ERR=""

# Terminal routing (ADR-0045 §5, #453). cold_pass classifies the agent's final message
# via scripts/terminal-signal.mjs and leaves the verdict here for the mode runner. Set
# as globals (NOT a `$(cold_pass)` capture) so the value survives without a subshell —
# cold_pass also writes per-iteration artefact paths into globals run_cold reads back.
RALPH_SIGNAL=""        # COMPLETE | HANDOFF | CONTINUE
RALPH_HANDOFF_N=""     # slices needing a human, parsed from a HANDOFF promise (may be empty)

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
MODE=""
PRD_N=""

usage() {
  echo "Usage: ralph.sh --once --prd N | --afk --prd N" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once)  MODE=once; shift ;;
    --afk)   MODE=afk;  shift ;;
    --prd)   PRD_N="$2"; shift 2 ;;
    *)       usage ;;
  esac
done

[[ -z "$MODE" ]] && usage
# Both modes self-select over a PRD's children (ADR-0045) — --prd is mandatory.
[[ -z "$PRD_N" ]] && { echo "ralph.sh --$MODE requires --prd N" >&2; exit 1; }

[[ -f "$PROMPT_FILE" ]] || {
  echo "ralph.sh: PROMPT.md not found — implement #411 first" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# progress.md helpers
# ---------------------------------------------------------------------------
read_attempts() {
  local issue=$1
  # progress.md is shared with the agent, so this counter can be duplicated or garbled
  # (the agent has appended `attempts_<n>:` lines mimicking our format). Collapse every
  # matching line to the MAX numeric value (default 0) — always a SINGLE clean integer,
  # so the `$(( ))` in increment_attempts and the `-ge K` cap checks can never receive a
  # multi-line value. Max is the conservative choice for the cap (never under-counts
  # attempts → never loops past K); non-numeric values count as 0.
  [[ -f "$PROGRESS" ]] || { echo 0; return; }
  grep -E "^attempts_${issue}:" "$PROGRESS" 2>/dev/null \
    | awk -F: '{ gsub(/[^0-9]/, "", $2); v = $2 + 0; if (v > m) m = v } END { print m + 0 }'
}

increment_attempts() {
  local issue=$1
  local current next
  current=$(read_attempts "$issue")    # guaranteed a single int → arithmetic is safe
  next=$((current + 1))
  touch "$PROGRESS"
  # Self-heal: delete EVERY attempts_<issue> line (collapsing any agent-introduced
  # duplicates) then append exactly one canonical line. Keeps the counter single-valued
  # no matter what the agent wrote into the shared scratchpad.
  sed -i.bak "/^attempts_${issue}:/d" "$PROGRESS"
  rm -f "${PROGRESS}.bak"
  echo "attempts_${issue}: $next" >> "$PROGRESS"
  echo "$next"
}

log_progress() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$PROGRESS"
}

# Append a structured line to ralph.log (tailable AFK heartbeat).
# MUST NOT write to stdout — stdout is the decision channel.
heartbeat() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$LOG"
}

# Read one KEY=VALUE from the per-iteration metrics file the formatter wrote.
# read_metric KEY FILE — empty string if the key (or file) is absent.
read_metric() {
  [[ -f "$2" ]] || return 0
  grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2-
}

# Fire a webhook POST when the loop hits an event worth waking a human for.
# Configured via RALPH_WEBHOOK_URL; no-op when unset (graceful degradation).
# MUST NOT write to stdout.
notify() {
  local msg=$1
  [[ -z "${RALPH_WEBHOOK_URL:-}" ]] && return 0
  curl -s -X POST "${RALPH_WEBHOOK_URL}" \
    -H "Content-Type: text/plain" \
    --data-raw "$msg" >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------------------
# GitHub helpers
# ---------------------------------------------------------------------------
is_issue_closed() {
  gh issue view "$1" --json state --jq '.state' 2>/dev/null | grep -qi "^CLOSED$"
}

# A slice is "done" the moment a gate-passed commit closing it lands on the branch
# — not when the issue closes (that happens at PR merge, which the human does after
# the run). The commit is durable, independent of the agent's prose, and could not
# exist without having passed the commit hook: the only honest done-predicate the
# loop can cross-check in bash. (ADR-0040 §5: verify before honouring the promise.)
has_closing_commit() {
  local n=$1 base range
  # Prefer origin/main as the comparison base. A missing local `main` (this repo has
  # none — only origin/main) or a stale/moved local `main` would corrupt `main..HEAD`,
  # hiding closing commits so delivered slices stay wrongly "eligible" and the loop
  # can never terminate. origin/main is the stable remote-tracking ref and is present
  # even in the passthrough-mounted sandbox. Fall back to local main, then to whole
  # HEAD history (always safe — over-matching our own branch lineage at worst).
  if git rev-parse --verify -q origin/main >/dev/null 2>&1; then base="origin/main"
  elif git rev-parse --verify -q main >/dev/null 2>&1; then base="main"
  else base=""; fi
  range="HEAD"; [[ -n "$base" ]] && range="${base}..HEAD"
  git log "$range" --pretty=%B 2>/dev/null | grep -qE "(Closes|Fixes|Resolves) #${n}([^0-9]|$)"
}

# ADR-0045: list_eligible is GONE. bash no longer judges eligibility — it does not
# parse `## Parent` / `## Blocked by` / attempts / closing commits to decide what is
# workable. It GATHERS the candidate corpus (gather_candidates below) and the agent
# self-selects the highest-priority unblocked `ready-for-agent` slice, treating a
# blocker as satisfied when it is closed OR labelled `ready-for-review` (PROMPT.md).

escalate() {
  local issue=$1 reason=$2
  echo "Ralph is handing #$issue to a grown-up — $reason" >&2
  gh issue edit "$issue" --remove-label "ready-for-agent" --add-label "ready-for-human" >/dev/null 2>&1 || true
  log_progress "ESCALATE #$issue: $reason"
  heartbeat "event=ESCALATE issue=$issue reason=$reason"
  notify "Ralph is handing #$issue to a grown-up — $reason (mode=$MODE)"
}

# Terminal success path: the loop has decided the work is COMPLETE. Try to push the
# branch and open the PR — but the commits are already durable locally, so a failure
# here (typically a sandbox with no GitHub auth secret) must NOT crash the run.
# Completion has to read as success (exit 0), never a non-zero abort at the moment of
# done-ness. Always exits.
finish_run() {
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)

  if gh pr list --head "$branch" --state open --json number --jq '.[0].number' 2>/dev/null | grep -qE '[0-9]'; then
    echo "Ralph is happy — a PR is already open on $branch!" >&2
    exit 0
  fi

  echo "Ralph is opening a PR on $branch → main!" >&2
  # `set -e` is suspended inside an `if` condition, so a failing push/create just
  # makes the branch false rather than aborting the script.
  if git push -u origin "$branch" && gh pr create --base main --fill; then
    echo "Ralph is done — PR opened on $branch! Ralph is happy!" >&2
    heartbeat "event=PR-OPENED branch=$branch"
    exit 0
  fi

  echo "Ralph is stuck — couldn't push/open the PR (no GitHub auth?). The work is committed locally; push + open it yourself. Ralph tried his best!" >&2
  log_progress "COMPLETE-LOCAL branch=$branch — push + open PR manually (or set sandbox GitHub auth)"
  heartbeat "event=COMPLETE-LOCAL branch=$branch"
  notify "Ralph is done but stuck on $branch — all work committed; push + open the PR yourself!"
  exit 0
}

# ---------------------------------------------------------------------------
# Gather (ADR-0045): the candidate corpus injected into every iteration.
# ---------------------------------------------------------------------------
# Dump the PRD's OPEN child issues — number, title, labels, full body — in ONE gh
# query, with NO eligibility/blocker/attempts filtering. Children are found by their
# `## Parent` ref to the PRD (finding the corpus by parent is gather, not judging);
# ALL labels are shown (ready-for-agent / ready-for-human / ready-for-review) so the
# agent has the dependency context to self-select and never works a HITL/done slice.
# `gh --jq` interprets bodies server-side, so literal control chars in a body cannot
# break the parse (the failure mode the old per-issue re-parse had).
gather_candidates() {
  echo "## PRD #$PRD_N — open issues (your candidate work)"
  echo
  echo "Self-select per PROMPT.md: the highest-priority UNBLOCKED issue labelled"
  echo "\`ready-for-agent\`. Never touch \`ready-for-human\` or \`ready-for-review\`."
  echo
  gh issue list --state open --limit 100 --json number,title,labels,body --jq '
    .[]
    | . as $i
    | (($i.body // "") | split("## Parent")[1] // "" | split("\n") | map(select(length>0))[0] // "") as $parentline
    | select($parentline | test("(^|[^0-9])'"$PRD_N"'([^0-9]|$)"))
    | "### #\($i.number): \($i.title)\nlabels: \([$i.labels[].name] | join(", "))\n\n\($i.body)\n"
  ' 2>/dev/null
}

# ---------------------------------------------------------------------------
# Cold claude invocation
# ---------------------------------------------------------------------------
run_cold() {
  local work_block=$1
  local git_log runbook_ctx prompt

  # ADR-0045: the agent's narrative memory across cold restarts is the git log (full
  # bodies — that is where the last iteration left its decisions + blockers), NOT a
  # progress.md scratchpad. Inject recent commits + the runbook (if it exists yet —
  # #457 scaffolds it; inject gracefully until then) + the candidate corpus.
  git_log=$(git log -n "${RALPH_LOG_N:-15}" --no-color 2>/dev/null || true)

  runbook_ctx="(no runbook yet — docs/agents/ralph-runbook.md not present)"
  [[ -f "$ROOT/docs/agents/ralph-runbook.md" ]] && runbook_ctx=$(cat "$ROOT/docs/agents/ralph-runbook.md")

  prompt=$(printf '%s\n\n---\n## Recent commits (git log -n %s — your narrative memory)\n\n```\n%s\n```\n\n---\n## Runbook (docs/agents/ralph-runbook.md)\n\n%s\n\n---\n%s\n' \
    "$(cat "$PROMPT_FILE")" \
    "${RALPH_LOG_N:-15}" \
    "$git_log" \
    "$runbook_ctx" \
    "$work_block")

  # --model sonnet: Agent SDK credit is capped; sonnet stretches it (ADR-0040 §7).
  # --output-format stream-json --verbose: emit a parseable event stream that
  # ralph-stream.mjs turns into a live feed (stderr), a raw per-iteration dump
  # ($RUN_JSONL), token/cost/turn metrics ($RUN_METRICS), and the ralph.current
  # status file — and prints ONLY the agent's final text on stdout.
  local claude_flags=("--model" "sonnet" "--output-format" "stream-json" "--verbose" "-p" "$prompt")
  [[ -n "${RALPH_MAX_TURNS:-}" ]] && claude_flags+=("--max-turns" "$RALPH_MAX_TURNS")
  [[ -n "${RALPH_MAX_USD:-}" ]] && claude_flags+=("--max-budget-usd" "$RALPH_MAX_USD")
  [[ "${RALPH_UNSAFE:-}" == "1" ]] && claude_flags+=("--dangerously-skip-permissions")

  local fmt=("node" "$ROOT/scripts/ralph-stream.mjs" "$RUN_JSONL" "$RUN_METRICS" "$CURRENT")

  # set +e around the pipeline so a non-zero claude/formatter (pipefail is on) cannot
  # abort the run at the moment of capture; grab PIPESTATUS immediately afterwards.
  # claude's status ([0]) is the real signal — a formatter hiccup ([1]) must not mask
  # it. CI + human-merge is the verifier of record (ADR-0045); this exit code is not consulted.
  # Send claude's OWN stderr to a per-iteration file, not the terminal: the formatter's
  # live feed (also stderr) is then the sole TTY writer. The file is forensics if claude
  # crashes.
  #
  # sbx (and potentially any agent CLI) puts the shared controlling terminal into raw
  # mode (ONLCR off — newline no longer implies carriage return) for the duration of the
  # run and does NOT restore it on exit. The symptom is a "staircase": every line we
  # print afterwards starts where the previous one ended, not at column 0 — the feed
  # during the run AND Ralph's echoes after it. Snapshot the terminal settings before the
  # pipeline and restore them after so the corruption can't leak past this function. A
  # no-op when stdin is not a TTY (AFK/cold-loop runs pipe their input — nothing to
  # staircase there). The feed itself also emits CRLF on a TTY (ralph-stream.mjs) so its
  # lines render correctly while the run is still in raw mode.
  local pipe tty_saved=""
  [[ -t 0 ]] && tty_saved=$(stty -g 2>/dev/null || true)
  set +e
  if [[ "${RALPH_UNSAFE:-}" == "1" ]]; then
    # Docker Sandbox microVM (ADR-0040 §7). $ROOT is mounted RW passthrough — do NOT
    # use --clone (strands commits in the VM). One-time auth: sbx secret set-custom -g
    #   --host api.anthropic.com --env CLAUDE_CODE_OAUTH_TOKEN --value "$CLAUDE_CODE_OAUTH_TOKEN"
    sbx run claude "$ROOT" -- "${claude_flags[@]}" 2>"$RUN_CLAUDE_ERR" | "${fmt[@]}"
  else
    claude "${claude_flags[@]}" 2>"$RUN_CLAUDE_ERR" | "${fmt[@]}"
  fi
  pipe=("${PIPESTATUS[@]}")
  set -e
  # Restore the terminal sbx/claude may have left in raw mode (see above).
  [[ -n "$tty_saved" ]] && { stty "$tty_saved" 2>/dev/null || true; }

  {
    echo "CLAUDE_EXIT=${pipe[0]:-?}"
    echo "FORMATTER_EXIT=${pipe[1]:-?}"
  } >> "$RUN_METRICS" 2>/dev/null || true

  # No result event = a real crash (NOT the normal error_max_turns exit-1, which still
  # emits a result). The live feed just went quiet, so point the human at the stderr we
  # captured — one line, after the pipeline, so it never interleaves with the feed.
  if [[ "$(read_metric RESULT_SEEN "$RUN_METRICS")" == "false" ]]; then
    echo "Ralph is confused — the agent gave nothing back (exit ${pipe[0]:-?}). Ralph wrote it down in $RUN_CLAUDE_ERR." >&2
  fi

  # Always succeed: run_cold's stdout (captured by cold_pass) is the agent's final
  # text; its exit status is not consulted, and a non-zero here would abort the caller
  # under `set -e`. CI + human-merge is the verifier of record (ADR-0045).
  return 0
}

# ---------------------------------------------------------------------------
# One cold pass (ADR-0045)
# ---------------------------------------------------------------------------
# Gather the candidate corpus, set up the per-iteration artefacts, and run one cold
# agent. The agent self-selects + tests + self-reviews + commits `Closes #N` + relabels
# `ready-for-agent` → `ready-for-review`, all INSIDE the cold process (PROMPT.md). bash
# no longer parses a `<selected>` marker, re-runs the gate, or tracks attempts — the
# loop's state is the commits + issue labels (gh), and CI + human-merge is the gate.
# What survives this function is observability only: ralph.log, ralph.current, the raw
# stream dump, and the metrics file.
cold_pass() {
  # Working-tree hygiene (#456, ADR-0045): reset at the start of every iteration so a
  # truncated/aborted prior pass cannot leave dirty state that poisons this one. HEAD is
  # never moved — only uncommitted file changes and untracked files are discarded.
  # Gitignored files (logs/, ralph.current, .env) are left untouched (no -x flag).
  git reset --hard
  git clean -ffd   # double -f overrides clean.requireForce=true in git config

  local work_block run_ts mstr
  work_block=$(gather_candidates)

  # Fresh per-iteration artefact paths (inherited by run_cold's subshell; the files the
  # formatter writes persist back here for the heartbeat).
  run_ts=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p "$RUNLOG_DIR"
  RUN_JSONL="$RUNLOG_DIR/ralph-${run_ts}-$$.jsonl"
  RUN_METRICS="$RUNLOG_DIR/ralph-${run_ts}-$$.metrics"
  RUN_CLAUDE_ERR="$RUNLOG_DIR/ralph-${run_ts}-$$.claude-stderr"

  echo "Ralph is calling an agent (mode=$MODE)! Watch him go: tail -f $RUN_JSONL | watch cat $CURRENT" >&2
  log_progress "START mode=$MODE"

  # Capture run_cold's stdout — the agent's final message — and route on it (ADR-0045 §5,
  # #453). The agent JUDGES doneness and emits a wrapped <promise> token; terminal-signal.mjs
  # classifies it to COMPLETE | HANDOFF | CONTINUE. bash never recounts work. run_cold's
  # live feed + metrics are stderr/files, so $() captures the final text cleanly; the
  # RUN_* artefact paths are read back from disk afterwards.
  local agent_out
  agent_out=$(run_cold "$work_block")

  # `|| true` is load-bearing: under `set -euo pipefail` a nonzero node (missing binary,
  # import/throw) would otherwise abort the whole run HERE, before the fallback below —
  # killing an unattended grind on a transient glitch. With it, a hiccup yields an empty
  # signal ⇒ CONTINUE ⇒ resume, never falsely "done".
  RALPH_SIGNAL=$(printf '%s' "$agent_out" | node "$ROOT/scripts/terminal-signal.mjs" 2>/dev/null || true)
  [[ -z "$RALPH_SIGNAL" ]] && RALPH_SIGNAL="CONTINUE"
  # N for the HANDOFF notification: the first integer inside the HANDOFF promise. The
  # PROMPT template literally shows `N`, so the agent may not substitute a count — empty
  # is fine, the mode runner falls back to "some".
  RALPH_HANDOFF_N=$(printf '%s' "$agent_out" | grep -oE 'HANDOFF[^<]*' | grep -oE '[0-9]+' | head -1 || true)

  mstr="dur=$(read_metric DURATION_S "$RUN_METRICS")s turns=$(read_metric NUM_TURNS "$RUN_METRICS")"
  mstr="$mstr in=$(read_metric TOKENS_IN "$RUN_METRICS") out=$(read_metric TOKENS_OUT "$RUN_METRICS")"
  mstr="$mstr cacheR=$(read_metric CACHE_READ "$RUN_METRICS") cacheW=$(read_metric CACHE_WRITE "$RUN_METRICS")"
  mstr="$mstr cost=\$$(read_metric COST_USD "$RUN_METRICS") result=$(read_metric RESULT_SUBTYPE "$RUN_METRICS")"

  log_progress "END mode=$MODE result=$(read_metric RESULT_SUBTYPE "$RUN_METRICS") turns=$(read_metric NUM_TURNS "$RUN_METRICS")"
  heartbeat "mode=$MODE prd=$PRD_N $mstr signal=$RALPH_SIGNAL"
}

# ---------------------------------------------------------------------------
# Mode runners
# ---------------------------------------------------------------------------
# `once`: one watched cold pass over the PRD; the human is the loop. No finish_run — the
# terminal signal is reported for information only (ADR-0045 §5: the COMPLETE/HANDOFF
# distinction is moot in `once`, load-bearing in `afk`).
run_once() {
  echo "Ralph is excited to do one watched pass over PRD #$PRD_N! (once)" >&2
  cold_pass
  echo "Ralph is done with his pass (signal=$RALPH_SIGNAL) — you're the loop now (once mode)." >&2
}

# `afk`: the unwatched grind loop. Cold-pass until a terminal signal or MAX (ADR-0045 §5,
# #453). The agent judges doneness each iteration and bash routes on its wrapped <promise>:
#   COMPLETE → every slice delivered → finish_run opens the PR (terminal, exits).
#   HANDOFF  → open HITL/blocked slices remain → notify "N need a human", STOP, NO PR.
#   CONTINUE → more ready-for-agent work (or a truncated iteration) → another cold pass.
# The working tree is reset at the start of every cold_pass (#456).
run_afk() {
  echo "Ralph is off to grind PRD #$PRD_N solo (afk, up to MAX=$MAX passes)!" >&2
  local i
  for ((i = 1; i <= MAX; i++)); do
    echo "Ralph is on afk pass $i/$MAX..." >&2
    cold_pass
    case "$RALPH_SIGNAL" in
      COMPLETE)
        echo "Ralph thinks every slice is delivered — opening the PR! (pass $i)" >&2
        heartbeat "mode=afk prd=$PRD_N event=COMPLETE pass=$i"
        notify "Ralph finished PRD #$PRD_N — every slice delivered! Opening the PR. (afk)"
        finish_run   # pushes + opens the PR, then exits
        ;;
      HANDOFF)
        local n="${RALPH_HANDOFF_N:-some}"
        echo "Ralph is handing off — $n slices need a human. No PR (HITL/blocked work remains)." >&2
        heartbeat "mode=afk prd=$PRD_N event=HANDOFF need_human=$n pass=$i"
        log_progress "HANDOFF mode=afk prd=$PRD_N need_human=$n — no PR; HITL/blocked work remains"
        notify "Ralph stopped on PRD #$PRD_N — $n slices need a human. No PR opened (afk)."
        exit 0
        ;;
      *)
        : # CONTINUE — more ready-for-agent work; run another cold pass.
        ;;
    esac
  done

  echo "Ralph hit his MAX=$MAX iteration cap on PRD #$PRD_N without a terminal signal." >&2
  heartbeat "mode=afk prd=$PRD_N event=MAX-HIT max=$MAX"
  notify "Ralph hit the MAX=$MAX iteration cap on PRD #$PRD_N without a terminal signal — needs a look."
}

# ---------------------------------------------------------------------------
case "$MODE" in
  once) run_once ;;
  afk)  run_afk ;;
esac
