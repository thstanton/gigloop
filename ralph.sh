#!/usr/bin/env bash
# ralph.sh — cold-restart AFK loop (ADR-0040)
#
# Usage:
#   ./ralph.sh --once N         one cold pass on issue #N; you are the loop
#   ./ralph.sh --issue N        retry until #N done or K attempts (HITL workhorse)
#   ./ralph.sh --afk --prd N    self-select + grind unblocked AFK children of PRD #N
#
# Env:
#   RALPH_K=3       per-issue cold-restart cap before escalation (default 3)
#   RALPH_MAX=20    global iteration cap per run (default 20)
#   RALPH_UNSAFE=1  add --dangerously-skip-permissions (Docker sandbox only)

set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
PROMPT_FILE="$ROOT/PROMPT.md"
PROGRESS="$ROOT/progress.md"
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

# ---------------------------------------------------------------------------
# GitHub helpers
# ---------------------------------------------------------------------------
is_issue_closed() {
  gh issue view "$1" --json state --jq '.state' 2>/dev/null | grep -qi "^CLOSED$"
}

# Print the issue number of the first unblocked ready-for-agent open child of PRD $PRD_N.
select_issue() {
  local prd=$PRD_N
  while IFS= read -r row; do
    local num body parent_line blocked ok=true ref
    num=$(echo "$row" | jq -r '.number')
    body=$(echo "$row" | jq -r '.body')

    # Must declare ## Parent pointing to the PRD
    parent_line=$(echo "$body" | awk '/^## Parent/{f=1; next} f{print; exit}')
    echo "$parent_line" | grep -qE "(^|[^0-9])${prd}([^0-9]|$)" || continue

    # All ## Blocked by refs must be closed
    while IFS= read -r ref; do
      is_issue_closed "$ref" || { ok=false; break; }
    done < <(echo "$body" | awk '/^## Blocked by/{f=1; next} /^## /{f=0} f && /- #/{print}' | grep -oE '[0-9]+')

    $ok || continue
    echo "$num"
    return 0
  done < <(gh issue list --label ready-for-agent --state open --json number,body --limit 50 --jq '.[]')
}

escalate() {
  local issue=$1 reason=$2
  echo "ralph: escalating #$issue — $reason" >&2
  gh issue edit "$issue" --remove-label "ready-for-agent" --add-label "ready-for-human" 2>/dev/null || true
  log_progress "ESCALATE #$issue: $reason"
}

open_pr_if_needed() {
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)
  if ! gh pr list --head "$branch" --state open --json number --jq '.[0].number' 2>/dev/null | grep -qE '[0-9]'; then
    echo "ralph: opening PR on $branch → main" >&2
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
  local issue=$1
  if [[ "$MODE" == "once" || "$MODE" == "issue" ]]; then
    is_issue_closed "$issue" && echo 0 || echo 1
  else
    # afk: how many unblocked ready-for-agent children remain
    select_issue | wc -l | tr -d ' '
  fi
}

# ---------------------------------------------------------------------------
# Cold claude invocation
# ---------------------------------------------------------------------------
run_cold() {
  local issue=$1
  local issue_data progress_ctx prompt

  issue_data=$(gh issue view "$issue" --json number,title,body \
    --jq '"Issue #\(.number): \(.title)\n\(.body)"')

  progress_ctx=""
  [[ -f "$PROGRESS" ]] && progress_ctx=$(cat "$PROGRESS")

  prompt=$(printf '%s\n\n---\n## progress.md\n%s\n\n---\n## Active issue\n%s\n' \
    "$(cat "$PROMPT_FILE")" \
    "$progress_ctx" \
    "$issue_data")

  local claude_flags=("-p" "$prompt")
  [[ "${RALPH_UNSAFE:-}" == "1" ]] && claude_flags+=("--dangerously-skip-permissions")

  # tee to stderr so the human can watch; capture stdout for promise detection
  claude "${claude_flags[@]}" 2>&1 | tee /dev/stderr || true
}

# ---------------------------------------------------------------------------
# Single iteration (shared plumbing)
# ---------------------------------------------------------------------------
run_iteration() {
  local issue=$1
  local attempts gate_exit=0 promise_present=false output remaining decision

  echo "ralph: cold iteration — issue #$issue" >&2
  attempts=$(increment_attempts "$issue")
  echo "ralph: attempt $attempts/$K" >&2
  log_progress "START #$issue attempt=$attempts"

  output=$(run_cold "$issue")

  echo "$output" | grep -q '<promise>COMPLETE</promise>' && promise_present=true

  run_gate || gate_exit=$?
  remaining=$(remaining_count "$issue")

  decision=$(node "$ROOT/scripts/loop-decision.mjs" "$gate_exit" "$promise_present" "$remaining")
  echo "ralph: gate=$gate_exit promise=$promise_present remaining=$remaining → $decision" >&2
  log_progress "END #$issue gate=$gate_exit promise=$promise_present remaining=$remaining decision=$decision"

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
    [[ $iters -gt $MAX ]] && { echo "ralph: global MAX ($MAX) reached — stopping" >&2; exit 1; }

    local attempts
    attempts=$(read_attempts "$ISSUE_N")
    if [[ $attempts -ge $K ]]; then
      escalate "$ISSUE_N" "exceeded $K attempts without completion"
      exit 0
    fi

    local decision
    decision=$(run_iteration "$ISSUE_N")

    if [[ "$decision" == "COMPLETE" ]]; then
      echo "ralph: #$ISSUE_N COMPLETE" >&2
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
    [[ $iters -gt $MAX ]] && { echo "ralph: global MAX ($MAX) reached — stopping" >&2; exit 1; }

    local issue
    issue=$(select_issue || true)

    if [[ -z "$issue" ]]; then
      echo "ralph: no unblocked ready-for-agent issues remain in PRD #$PRD_N" >&2
      open_pr_if_needed
      exit 0
    fi

    local attempts
    attempts=$(read_attempts "$issue")
    if [[ $attempts -ge $K ]]; then
      escalate "$issue" "exceeded $K attempts without completion"
      continue
    fi

    local decision
    decision=$(run_iteration "$issue")

    if [[ "$decision" == "COMPLETE" ]]; then
      echo "ralph: #$issue COMPLETE — selecting next" >&2
    fi
  done
}

# ---------------------------------------------------------------------------
case "$MODE" in
  once)  run_once ;;
  issue) run_issue ;;
  afk)   run_afk ;;
esac
