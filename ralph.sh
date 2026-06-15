#!/usr/bin/env bash
# ralph.sh — cold-restart AFK loop (ADR-0040)
#
# Usage:
#   ./ralph.sh --once N         one cold pass on issue #N; you are the loop
#   ./ralph.sh --issue N        retry until #N done or K attempts (HITL workhorse)
#   ./ralph.sh --afk --prd N    self-select + grind unblocked AFK children of PRD #N
#
# Env:
#   RALPH_K=3              per-issue cold-restart cap before escalation (default 3)
#   RALPH_MAX=20           global iteration cap per run (default 20)
#   RALPH_STALL=2          consecutive NO-SELECTION iterations before a clean stall
#                          (afk mode; default 2 — stops spinning when the agent keeps
#                          declining work bash still lists)
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

# Per-iteration stream artefact paths — set fresh in run_iteration, read back for the
# heartbeat. run_cold runs in a `$(...)` subshell that inherits these; the FILES the
# formatter writes persist beyond it.
RUN_JSONL=""
RUN_METRICS=""

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
MODE=""
ISSUE_N=""
PRD_N=""

usage() {
  echo "Usage: ralph.sh --once N | --issue N | --afk --prd N" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once)  MODE=once;  ISSUE_N="$2"; shift 2 ;;
    --issue) MODE=issue; ISSUE_N="$2"; shift 2 ;;
    --afk)   MODE=afk; shift ;;
    --prd)   PRD_N="$2"; shift 2 ;;
    *)       usage ;;
  esac
done

[[ -z "$MODE" ]] && usage
[[ "$MODE" == "afk" && -z "$PRD_N" ]] && { echo "ralph.sh --afk requires --prd N" >&2; exit 1; }
[[ ("$MODE" == "once" || "$MODE" == "issue") && -z "$ISSUE_N" ]] && usage

[[ -f "$PROMPT_FILE" ]] || {
  echo "ralph.sh: PROMPT.md not found — implement #411 first" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# progress.md helpers
# ---------------------------------------------------------------------------
read_attempts() {
  local issue=$1
  if [[ -f "$PROGRESS" ]]; then
    local val
    val=$(grep -E "^attempts_${issue}:" "$PROGRESS" 2>/dev/null | awk -F: '{print $2}' | tr -d ' ' || true)
    [[ -n "$val" ]] && { echo "$val"; return; }
  fi
  echo 0
}

increment_attempts() {
  local issue=$1
  local current next
  current=$(read_attempts "$issue")
  next=$((current + 1))
  touch "$PROGRESS"
  if grep -q "^attempts_${issue}:" "$PROGRESS" 2>/dev/null; then
    sed -i.bak "s/^attempts_${issue}:.*/attempts_${issue}: $next/" "$PROGRESS"
    rm -f "${PROGRESS}.bak"
  else
    echo "attempts_${issue}: $next" >> "$PROGRESS"
  fi
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

# Print every eligible slice (one issue number per line): open, ready-for-agent,
# a child of PRD $PRD_N, not yet committed, under the attempt cap, all blockers
# satisfied (closed OR already committed on this branch). bash *filters*; the agent
# *picks* — that split is the whole point (ADR-0040 §4).
list_eligible() {
  local prd=$PRD_N num body parent_line ok ref refs

  # Drive off issue *numbers* only, then fetch each body with a targeted
  # `gh issue view --jq` call. The old form streamed `gh ... --jq '.[]'` and
  # re-parsed each line with `echo "$row" | jq` — which throws
  # "Invalid string: control characters U+0000–U+001F must be escaped" whenever a
  # body contains a literal control char, silently dropping the issue and making
  # this function (and remaining_count) non-deterministic. `gh --jq` interprets the
  # field server-side and prints it raw, so no body content can break the parse.
  #
  # Iterate over a word-split number list (issue numbers never contain spaces), NOT
  # a `while read < <(gh ...)` loop: the per-issue `gh issue view` / `is_issue_closed`
  # calls below read stdin and would drain a process-substitution feed, killing the
  # loop after one pass.
  for num in $(gh issue list --label ready-for-agent --state open --json number --limit 50 --jq '.[].number' 2>/dev/null); do
    ok=true

    body=$(gh issue view "$num" --json body --jq '.body' 2>/dev/null) || continue

    # Must declare ## Parent pointing to the PRD
    parent_line=$(echo "$body" | awk '/^## Parent/{f=1; next} f{print; exit}')
    echo "$parent_line" | grep -qE "(^|[^0-9])${prd}([^0-9]|$)" || continue

    # Already delivered on this branch?
    has_closing_commit "$num" && continue

    # Burned through its cold-restart attempts?
    [[ "$(read_attempts "$num")" -ge "$K" ]] && continue

    # Every ## Blocked by ref must be closed OR already committed on this branch.
    # Match any `#N` anywhere in the block (not only lines starting `- #`), and key
    # off the `#` so issue refs are picked up even when prose follows
    # ("- Slice 3 (event-type filter) #421") without numbers in the description text
    # being mistaken for blockers. NB: blockers written with no `#N` ref at all are
    # invisible here by design — an issue-authoring requirement, not a parser gap.
    refs=$(echo "$body" | awk '/^## Blocked by/{f=1; next} /^## /{f=0} f' | grep -oE '#[0-9]+' | tr -d '#')
    for ref in $refs; do
      is_issue_closed "$ref" || has_closing_commit "$ref" || { ok=false; break; }
    done

    $ok || continue
    echo "$num"
  done
}

escalate() {
  local issue=$1 reason=$2
  echo "ralph: escalating #$issue — $reason" >&2
  gh issue edit "$issue" --remove-label "ready-for-agent" --add-label "ready-for-human" >/dev/null 2>&1 || true
  log_progress "ESCALATE #$issue: $reason"
  heartbeat "event=ESCALATE issue=$issue reason=$reason"
  notify "ralph: ESCALATE #$issue — $reason (mode=$MODE)"
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
    echo "ralph: PR already open on $branch — done" >&2
    exit 0
  fi

  echo "ralph: opening PR on $branch → main" >&2
  # `set -e` is suspended inside an `if` condition, so a failing push/create just
  # makes the branch false rather than aborting the script.
  if git push -u origin "$branch" && gh pr create --base main --fill; then
    echo "ralph: PR opened on $branch — done" >&2
    heartbeat "event=PR-OPENED branch=$branch"
    exit 0
  fi

  echo "ralph: could not push / open PR (no GitHub auth?) — work is committed locally; push + open the PR manually" >&2
  log_progress "COMPLETE-LOCAL branch=$branch — push + open PR manually (or set sandbox GitHub auth)"
  heartbeat "event=COMPLETE-LOCAL branch=$branch"
  notify "ralph: COMPLETE-LOCAL $branch — all work committed; push + open PR manually"
  exit 0
}

# ---------------------------------------------------------------------------
# Gate (prepush: test + build on changed workspaces)
# ---------------------------------------------------------------------------
run_gate() {
  bash "$ROOT/scripts/hooks/prepush.sh"
}

# ---------------------------------------------------------------------------
# remainingWorkCount for loop-decision
# ---------------------------------------------------------------------------
remaining_count() {
  if [[ "$MODE" == "afk" ]]; then
    # how many eligible slices are still undelivered
    list_eligible | wc -l | tr -d ' '
  else
    # pinned: done iff a commit closing it exists on the branch
    has_closing_commit "$1" && echo 0 || echo 1
  fi
}

# ---------------------------------------------------------------------------
# Work-block builders (the mode-specific tail of the injected prompt)
# ---------------------------------------------------------------------------
build_work_block_pinned() {
  gh issue view "$1" --json number,title,body \
    --jq '"## Active issue (pinned — work this one)\n\nIssue #\(.number): \(.title)\n\(.body)"'
}

build_work_block_candidates() {
  echo "## PRD #$PRD_N — candidate slices"
  echo
  echo "Filtered to eligible, unblocked, AFK-appropriate work. Choose ONE by judgement"
  echo "and emit <selected>N</selected>."
  echo
  local n
  while IFS= read -r n; do
    [[ -z "$n" ]] && continue
    gh issue view "$n" --json number,title,labels,body \
      --jq '"### #\(.number): \(.title)\nlabels: \([.labels[].name] | join(", "))\n\n\(.body)\n"'
  done < <(list_eligible)
}

# ---------------------------------------------------------------------------
# Cold claude invocation
# ---------------------------------------------------------------------------
run_cold() {
  local work_block=$1
  local progress_ctx prompt

  progress_ctx=""
  [[ -f "$PROGRESS" ]] && progress_ctx=$(cat "$PROGRESS")

  prompt=$(printf '%s\n\n---\n## progress.md\n%s\n\n---\n%s\n' \
    "$(cat "$PROMPT_FILE")" \
    "$progress_ctx" \
    "$work_block")

  # --model sonnet: Agent SDK credit is capped; sonnet stretches it (ADR-0040 §7).
  # --output-format stream-json --verbose: emit a parseable event stream that
  # ralph-stream.mjs turns into a live feed (stderr), a raw per-iteration dump
  # ($RUN_JSONL), token/cost/turn metrics ($RUN_METRICS), and the ralph.current
  # status file — and prints ONLY the agent's final text on stdout, so the
  # <selected>/<promise> markers below are matched exactly as before.
  local claude_flags=("--model" "sonnet" "--output-format" "stream-json" "--verbose" "-p" "$prompt")
  [[ -n "${RALPH_MAX_TURNS:-}" ]] && claude_flags+=("--max-turns" "$RALPH_MAX_TURNS")
  [[ -n "${RALPH_MAX_USD:-}" ]] && claude_flags+=("--max-budget-usd" "$RALPH_MAX_USD")
  [[ "${RALPH_UNSAFE:-}" == "1" ]] && claude_flags+=("--dangerously-skip-permissions")

  local fmt=("node" "$ROOT/scripts/ralph-stream.mjs" "$RUN_JSONL" "$RUN_METRICS" "$CURRENT")

  # set +e around the pipeline so a non-zero claude/formatter (pipefail is on) cannot
  # abort the run at the moment of capture; grab PIPESTATUS immediately afterwards.
  # claude's status ([0]) is the real signal — a formatter hiccup ([1]) must not mask
  # it. The verifier of record is still the gate (run_gate), not this exit code.
  local pipe
  set +e
  if [[ "${RALPH_UNSAFE:-}" == "1" ]]; then
    # Docker Sandbox microVM (ADR-0040 §7). $ROOT is mounted RW passthrough — do NOT
    # use --clone (strands commits in the VM). One-time auth: sbx secret set-custom -g
    #   --host api.anthropic.com --env CLAUDE_CODE_OAUTH_TOKEN --value "$CLAUDE_CODE_OAUTH_TOKEN"
    sbx run claude "$ROOT" -- "${claude_flags[@]}" | "${fmt[@]}"
  else
    claude "${claude_flags[@]}" | "${fmt[@]}"
  fi
  pipe=("${PIPESTATUS[@]}")
  set -e

  {
    echo "CLAUDE_EXIT=${pipe[0]:-?}"
    echo "FORMATTER_EXIT=${pipe[1]:-?}"
  } >> "$RUN_METRICS" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Single iteration (shared plumbing)
#   pinned modes pass the issue number; afk learns it from <selected>N</selected>.
# ---------------------------------------------------------------------------
run_iteration() {
  local pinned="${1:-}"
  local work_block selected attempts gate_exit=0 promise_present=false output remaining decision
  local run_ts mstr

  if [[ "$MODE" == "afk" ]]; then
    work_block=$(build_work_block_candidates)
  else
    work_block=$(build_work_block_pinned "$pinned")
  fi

  # Fresh per-iteration artefact paths (inherited by run_cold's subshell; the files the
  # formatter writes persist back here for the heartbeat).
  run_ts=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p "$RUNLOG_DIR"
  RUN_JSONL="$RUNLOG_DIR/ralph-${run_ts}-$$.jsonl"
  RUN_METRICS="$RUNLOG_DIR/ralph-${run_ts}-$$.metrics"

  echo "ralph: cold iteration (mode=$MODE) — live: tail -f $RUN_JSONL | watch cat $CURRENT" >&2
  log_progress "START mode=$MODE"

  output=$(run_cold "$work_block")

  # Per-iteration metrics (turns/tokens/cost/duration) for the heartbeat — appended to
  # both the NO-SELECTION and END lines so every iteration's cost is visible in ralph.log.
  mstr="dur=$(read_metric DURATION_S "$RUN_METRICS")s turns=$(read_metric NUM_TURNS "$RUN_METRICS")"
  mstr="$mstr in=$(read_metric TOKENS_IN "$RUN_METRICS") out=$(read_metric TOKENS_OUT "$RUN_METRICS")"
  mstr="$mstr cacheR=$(read_metric CACHE_READ "$RUN_METRICS") cacheW=$(read_metric CACHE_WRITE "$RUN_METRICS")"
  mstr="$mstr cost=\$$(read_metric COST_USD "$RUN_METRICS") result=$(read_metric RESULT_SUBTYPE "$RUN_METRICS")"

  if [[ "$MODE" == "afk" ]]; then
    selected=$(echo "$output" | grep -oE '<selected>[0-9]+</selected>' | tail -1 | grep -oE '[0-9]+' || true)
  else
    selected="$pinned"
  fi

  if [[ -z "$selected" ]]; then
    echo "ralph: no issue selected this iteration" >&2
    log_progress "NO-SELECTION mode=$MODE result=$(read_metric RESULT_SUBTYPE "$RUN_METRICS")"
    heartbeat "mode=$MODE issue=none decision=NO-SELECTION $mstr"
    # Distinct from CONTINUE so the caller can count consecutive declines and stall
    # rather than spin billed cold invocations to MAX (see run_afk circuit-breaker).
    echo "NO-SELECTION"
    return 0
  fi

  attempts=$(increment_attempts "$selected")
  echo "ralph: issue #$selected — attempt $attempts/$K" >&2

  echo "$output" | grep -q '<promise>COMPLETE</promise>' && promise_present=true

  # gate output → stderr (human watches there); stdout stays the clean decision channel
  run_gate >&2 || gate_exit=$?
  remaining=$(remaining_count "$selected")

  decision=$(node "$ROOT/scripts/loop-decision.mjs" "$gate_exit" "$promise_present" "$remaining")
  echo "ralph: #$selected gate=$gate_exit promise=$promise_present remaining=$remaining → $decision" >&2
  # The next cold agent reads progress.md, not ralph.log — so the outcome subtype must
  # land here too. result=error_max_turns/error_* means "truncated/crashed, resume the
  # unfinished slice", which is NOT the same as a genuine gate failure (ADR-0040).
  log_progress "END #$selected gate=$gate_exit promise=$promise_present remaining=$remaining decision=$decision result=$(read_metric RESULT_SUBTYPE "$RUN_METRICS") turns=$(read_metric NUM_TURNS "$RUN_METRICS")"
  heartbeat "mode=$MODE issue=$selected attempt=$attempts/$K gate=$gate_exit promise=$promise_present decision=$decision $mstr"

  # Escalate this issue if K cold attempts produced no closing commit.
  if ! has_closing_commit "$selected" && [[ "$attempts" -ge "$K" ]]; then
    escalate "$selected" "exceeded $K attempts without a closing commit"
  fi

  echo "$decision"
}

# ---------------------------------------------------------------------------
# Mode runners
# ---------------------------------------------------------------------------
run_once() {
  echo "ralph: --once #$ISSUE_N" >&2
  run_iteration "$ISSUE_N" > /dev/null
  echo "ralph: done (you are the loop in --once mode)" >&2
}

run_issue() {
  echo "ralph: --issue #$ISSUE_N (K=$K MAX=$MAX)" >&2
  local iters=0

  while true; do
    iters=$((iters + 1))
    if [[ $iters -gt $MAX ]]; then
      echo "ralph: global MAX ($MAX) reached — stopping" >&2
      heartbeat "mode=issue issue=$ISSUE_N event=MAX-HIT iters=$iters"
      notify "ralph: MAX-HIT after $iters iterations on #$ISSUE_N (mode=issue)"
      exit 1
    fi

    if has_closing_commit "$ISSUE_N"; then
      echo "ralph: #$ISSUE_N already delivered on this branch" >&2
      finish_run
    fi

    # Already escalated on a prior run? Stop (the relabel persists across restarts).
    if [[ "$(read_attempts "$ISSUE_N")" -ge $K ]]; then
      echo "ralph: #$ISSUE_N at attempt cap — handed to a human" >&2
      exit 0
    fi

    # Agent may have relabeled to ready-for-human mid-run — respect it immediately
    # rather than burning through the remaining K attempts.
    if gh issue view "$ISSUE_N" --json labels --jq '.labels[].name' 2>/dev/null \
        | grep -q "ready-for-human"; then
      echo "ralph: #$ISSUE_N relabeled to ready-for-human — stopping" >&2
      heartbeat "mode=issue issue=$ISSUE_N event=ESCALATED-BY-AGENT"
      exit 0
    fi

    local decision
    decision=$(run_iteration "$ISSUE_N")

    if [[ "$decision" == "COMPLETE" ]]; then
      echo "ralph: #$ISSUE_N COMPLETE" >&2
      heartbeat "mode=issue issue=$ISSUE_N event=COMPLETE iters=$iters"
      notify "ralph: COMPLETE #$ISSUE_N (mode=issue, $iters iterations)"
      finish_run
    fi
  done
}

run_afk() {
  echo "ralph: --afk --prd #$PRD_N (K=$K MAX=$MAX STALL=$STALL)" >&2
  local iters=0 no_select_streak=0

  while true; do
    iters=$((iters + 1))
    if [[ $iters -gt $MAX ]]; then
      echo "ralph: global MAX ($MAX) reached — stopping" >&2
      heartbeat "mode=afk prd=$PRD_N event=MAX-HIT iters=$iters"
      notify "ralph: MAX-HIT after $iters iterations on PRD #$PRD_N (mode=afk)"
      exit 1
    fi

    if [[ -z "$(list_eligible)" ]]; then
      echo "ralph: no eligible ready-for-agent slices remain in PRD #$PRD_N" >&2
      heartbeat "mode=afk prd=$PRD_N event=COMPLETE iters=$iters"
      notify "ralph: COMPLETE PRD #$PRD_N — no eligible slices remain ($iters iterations)"
      finish_run
    fi

    local decision
    decision=$(run_iteration)

    if [[ "$decision" == "COMPLETE" ]]; then
      echo "ralph: PRD #$PRD_N COMPLETE — no eligible work remains" >&2
      heartbeat "mode=afk prd=$PRD_N event=COMPLETE iters=$iters"
      notify "ralph: COMPLETE PRD #$PRD_N — promise received ($iters iterations)"
      finish_run
    fi

    # Circuit-breaker. We only reach here with list_eligible non-empty, so a
    # NO-SELECTION means bash thinks there is work but the agent declined it. One
    # miss can be a transient model hiccup; STALL in a row means the candidate set
    # is stale or the agent is stuck — stop cleanly and let a human look instead of
    # spinning billed cold invocations all the way to MAX (the bug this fixes).
    if [[ "$decision" == "NO-SELECTION" ]]; then
      no_select_streak=$((no_select_streak + 1))
      if [[ $no_select_streak -ge $STALL ]]; then
        echo "ralph: $no_select_streak consecutive NO-SELECTIONs with work still listed — stalling" >&2
        log_progress "STALL mode=afk prd=$PRD_N consecutive_no_selection=$no_select_streak"
        heartbeat "mode=afk prd=$PRD_N event=STALL no_selection=$no_select_streak"
        notify "ralph: STALL PRD #$PRD_N — agent declined ${no_select_streak}× while work listed (mode=afk)"
        exit 0
      fi
    else
      no_select_streak=0
    fi
  done
}

# ---------------------------------------------------------------------------
case "$MODE" in
  once)  run_once ;;
  issue) run_issue ;;
  afk)   run_afk ;;
esac
