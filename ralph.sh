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
#   RALPH_UNSAFE=1         run inside Docker Sandbox + --dangerously-skip-permissions
#   RALPH_WEBHOOK_URL=url  POST target for ESCALATE/COMPLETE/MAX-HIT events (optional)
#
# Observing an AFK run (no extra tooling required):
#   GitHub mobile is the zero-code dashboard — watch for ready-for-human label
#   flips, per-slice commits on the branch, and the completion PR notification.
#   For richer signals: `tail -f ralph.log` (one structured line per iteration);
#   set RALPH_WEBHOOK_URL to push-notify on ESCALATE/COMPLETE/MAX-HIT.
#   Note: agent clean-aborts (PROMPT.md step 7) relabel the issue inside the
#   cold claude process — ralph.sh's escalate() never sees them, so no webhook
#   fires on that path. Watch for ready-for-human label changes on the repo.

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
PROMPT_FILE="$ROOT/PROMPT.md"
PROGRESS="$ROOT/progress.md"
LOG="$ROOT/ralph.log"
K="${RALPH_K:-3}"
MAX="${RALPH_MAX:-20}"

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
  local n=$1 range
  if git rev-parse --verify -q main >/dev/null 2>&1; then range="main..HEAD"; else range="HEAD"; fi
  git log "$range" --pretty=%B 2>/dev/null | grep -qE "(Closes|Fixes|Resolves) #${n}([^0-9]|$)"
}

# Print every eligible slice (one issue number per line): open, ready-for-agent,
# a child of PRD $PRD_N, not yet committed, under the attempt cap, all blockers
# satisfied (closed OR already committed on this branch). bash *filters*; the agent
# *picks* — that split is the whole point (ADR-0040 §4).
list_eligible() {
  local prd=$PRD_N
  while IFS= read -r row; do
    local num body parent_line ok=true ref
    num=$(echo "$row" | jq -r '.number')
    body=$(echo "$row" | jq -r '.body')

    # Must declare ## Parent pointing to the PRD
    parent_line=$(echo "$body" | awk '/^## Parent/{f=1; next} f{print; exit}')
    echo "$parent_line" | grep -qE "(^|[^0-9])${prd}([^0-9]|$)" || continue

    # Already delivered on this branch?
    has_closing_commit "$num" && continue

    # Burned through its cold-restart attempts?
    [[ "$(read_attempts "$num")" -ge "$K" ]] && continue

    # Every ## Blocked by ref must be closed OR already committed on this branch
    while IFS= read -r ref; do
      is_issue_closed "$ref" || has_closing_commit "$ref" || { ok=false; break; }
    done < <(echo "$body" | awk '/^## Blocked by/{f=1; next} /^## /{f=0} f && /- #/{print}' | grep -oE '[0-9]+')

    $ok || continue
    echo "$num"
  done < <(gh issue list --label ready-for-agent --state open --json number,body --limit 50 --jq '.[]')
}

escalate() {
  local issue=$1 reason=$2
  echo "ralph: escalating #$issue — $reason" >&2
  gh issue edit "$issue" --remove-label "ready-for-agent" --add-label "ready-for-human" >/dev/null 2>&1 || true
  log_progress "ESCALATE #$issue: $reason"
  heartbeat "event=ESCALATE issue=$issue reason=$reason"
  notify "ralph: ESCALATE #$issue — $reason (mode=$MODE)"
}

open_pr_if_needed() {
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)
  if ! gh pr list --head "$branch" --state open --json number --jq '.[0].number' 2>/dev/null | grep -qE '[0-9]'; then
    echo "ralph: opening PR on $branch → main" >&2
    git push -u origin "$branch"
    gh pr create --base main --fill
  fi
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
  local claude_flags=("--model" "sonnet" "-p" "$prompt")
  [[ "${RALPH_UNSAFE:-}" == "1" ]] && claude_flags+=("--dangerously-skip-permissions")

  if [[ "${RALPH_UNSAFE:-}" == "1" ]]; then
    # Run inside a Docker Sandbox microVM (ADR-0040 §7).
    # Default RW passthrough mount — do NOT add --clone (strands commits in the VM).
    # CLAUDE_CODE_OAUTH_TOKEN must be set in the host shell via `claude setup-token`.
    sbx run -e "CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN:-}" \
      -- claude "${claude_flags[@]}" 2>&1 | tee /dev/stderr || true
  else
    # tee to stderr so the human can watch; capture stdout for promise/selection markers
    claude "${claude_flags[@]}" 2>&1 | tee /dev/stderr || true
  fi
}

# ---------------------------------------------------------------------------
# Single iteration (shared plumbing)
#   pinned modes pass the issue number; afk learns it from <selected>N</selected>.
# ---------------------------------------------------------------------------
run_iteration() {
  local pinned="${1:-}"
  local work_block selected attempts gate_exit=0 promise_present=false output remaining decision

  if [[ "$MODE" == "afk" ]]; then
    work_block=$(build_work_block_candidates)
  else
    work_block=$(build_work_block_pinned "$pinned")
  fi

  echo "ralph: cold iteration (mode=$MODE)" >&2
  log_progress "START mode=$MODE"

  output=$(run_cold "$work_block")

  if [[ "$MODE" == "afk" ]]; then
    selected=$(echo "$output" | grep -oE '<selected>[0-9]+</selected>' | tail -1 | grep -oE '[0-9]+' || true)
  else
    selected="$pinned"
  fi

  if [[ -z "$selected" ]]; then
    echo "ralph: no issue selected this iteration" >&2
    log_progress "NO-SELECTION mode=$MODE"
    heartbeat "mode=$MODE issue=none decision=CONTINUE"
    echo "CONTINUE"
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
  log_progress "END #$selected gate=$gate_exit promise=$promise_present remaining=$remaining decision=$decision"
  heartbeat "mode=$MODE issue=$selected attempt=$attempts/$K gate=$gate_exit promise=$promise_present decision=$decision"

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
      open_pr_if_needed
      exit 0
    fi

    # Already escalated on a prior run? Stop (the relabel persists across restarts).
    if [[ "$(read_attempts "$ISSUE_N")" -ge $K ]]; then
      echo "ralph: #$ISSUE_N at attempt cap — handed to a human" >&2
      exit 0
    fi

    local decision
    decision=$(run_iteration "$ISSUE_N")

    if [[ "$decision" == "COMPLETE" ]]; then
      echo "ralph: #$ISSUE_N COMPLETE" >&2
      heartbeat "mode=issue issue=$ISSUE_N event=COMPLETE iters=$iters"
      notify "ralph: COMPLETE #$ISSUE_N (mode=issue, $iters iterations)"
      open_pr_if_needed
      exit 0
    fi
  done
}

run_afk() {
  echo "ralph: --afk --prd #$PRD_N (K=$K MAX=$MAX)" >&2
  local iters=0

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
      open_pr_if_needed
      exit 0
    fi

    local decision
    decision=$(run_iteration)

    if [[ "$decision" == "COMPLETE" ]]; then
      echo "ralph: PRD #$PRD_N COMPLETE — no eligible work remains" >&2
      heartbeat "mode=afk prd=$PRD_N event=COMPLETE iters=$iters"
      notify "ralph: COMPLETE PRD #$PRD_N — promise received ($iters iterations)"
      open_pr_if_needed
      exit 0
    fi
  done
}

# ---------------------------------------------------------------------------
case "$MODE" in
  once)  run_once ;;
  issue) run_issue ;;
  afk)   run_afk ;;
esac
