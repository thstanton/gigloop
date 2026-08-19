#!/usr/bin/env bash
# claimability.sh <issue> — fleet claim precheck (docs/agents/fleet.md).
#
# Prints the in-flight map, extracts each issue's declared Surfaces, and reports
# whether <issue> can be claimed: surfaces disjoint from every in-flight claim,
# a free WIP slot, and a free schema lock.
#
# Two heuristics, both advice — sanity-check the verdict against the codebase:
#   • Surface parsing pulls `backticked` tokens from the canonical "**Surfaces:**"
#     annotation in the issue body or its comments.
#   • The WIP count de-duplicates by claim branch (one branch = one PR = one
#     review desk-crossing), reading the branch each claim comment names. The cap
#     is ADVISORY: reaching it warns and still reports CLAIMABLE — it budgets the
#     human's review attention, not correctness. Surface disjointness and the
#     schema lock are the hard blocks (non-zero exit) that prevent real corruption.
set -uo pipefail

# Keep in sync with the WIP cap in docs/agents/fleet.md — the doc is the authority.
WIP_CAP=5
issue="${1:?usage: claimability.sh <issue-number>}"

command -v gh >/dev/null 2>&1 || { echo "error: gh CLI not found on PATH" >&2; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "error: gh not authenticated (run: gh auth login)" >&2; exit 2; }

# Newline-separated, de-duplicated surface tokens for an issue. Reads only the
# canonical bolded "**Surfaces …:**" annotation (agent brief / escalation comment),
# not prose that merely mentions "surface" — the latter is a false-positive source.
surfaces_of() {
  { gh issue view "$1" --json body,comments \
      --jq '[.body, (.comments[].body // empty)] | join("\n")' 2>/dev/null \
    | grep -E '\*\*[Ss]urfaces?' \
    | grep -oE '`[^`]+`' | tr -d '`' | sort -u ; } || true
}

# The claim branch an issue's claim comment names. The claim protocol requires
# every claimant to post a "Branch:"-labelled line naming its branch, so we anchor
# to that label, pull the backticked branch-shaped token, and take the first.
# The `<type>/<number>-` shape is what makes this precise: it matches real claim
# branches (`feat/786-…`, `fix/785-…`, `feature/794-…`, `docs/787-…`) while
# rejecting both prose paths (`docs/agents/fleet.md` — no leading digits) and the
# slashless temp-worktree names (`wt-795-…`) that sub-issues sometimes list
# alongside their real consolidation branch. Empty when nothing is recoverable.
branch_of() {
  { gh issue view "$1" --json comments \
      --jq '[.comments[].body // empty] | join("\n")' 2>/dev/null \
    | grep -E 'Branch[[:space:]]*[:|]' \
    | grep -oE '`[^`]+`' | tr -d '`' \
    | grep -oE '(feat|feature|fix|chore|docs|refactor|perf|build|ci|style|test)/[0-9]+-[A-Za-z0-9._-]+' \
    | head -n1 ; } || true
}

title_of() { gh issue view "$1" --json title --jq .title 2>/dev/null || echo "?"; }

mine="$(surfaces_of "$issue")"
inflight=()
while IFS= read -r _n; do [ -n "$_n" ] && inflight+=("$_n"); done < <(
  gh issue list --label in-progress --state open --json number --jq '.[].number' 2>/dev/null \
  | grep -vx "$issue" || true)

# WIP is denominated in review desk-crossings, i.e. distinct claim branches — not
# issues. Sub-issues claimed on one branch (CLAUDE.md: "one feature = one branch =
# one PR") collapse to a single slot. A claim with no recoverable branch counts as
# one, keyed by its own issue number so it stays distinct.
keys=()
for _n in "${inflight[@]:-}"; do
  [ -z "$_n" ] && continue
  _b="$(branch_of "$_n")"
  keys+=("${_b:-#$_n}")
done
inflight_branches="$(printf '%s\n' "${keys[@]:-}" | grep -v '^$' | sort -u)"
if [ -n "$inflight_branches" ]; then wip=$(wc -l <<<"$inflight_branches" | tr -d ' '); else wip=0; fi

echo "═══ Claimability precheck for #$issue ($(title_of "$issue")) ═══"
echo
echo "Declared surfaces for #$issue:"
if [ -n "$mine" ]; then sed 's/^/  • /' <<<"$mine"; else echo "  (none found)"; fi
echo
echo "In-flight (distinct claim branches): $wip   |   WIP cap: $WIP_CAP (advisory)"
if [ -n "$inflight_branches" ]; then sed 's/^/  ↳ /' <<<"$inflight_branches"; fi

reasons=()   # hard blocks → non-zero exit (real corruption risk)
warnings=()  # advisory → still claimable, confirm with the human

# WIP cap is advisory: it protects the human's review attention, has no correctness
# consequence, and the human is present to be asked. Warn, don't block.
[ "$wip" -ge "$WIP_CAP" ] && warnings+=("WIP cap reached ($wip in-flight branch(es) ≥ $WIP_CAP) — one more review-desk crossing; confirm with the human before claiming")

# Missing surfaces → cannot verify disjointness. Hard block.
[ -z "$mine" ] && reasons+=("no Surfaces declared on #$issue — cannot verify disjointness")

schema_me=0; grep -qiE 'schema' <<<"$mine" && schema_me=1

echo
echo "Surface disjointness vs each in-flight claim:"
if [ "${#inflight[@]}" -eq 0 ]; then
  echo "  (no other in-flight claims)"
else
  for n in "${inflight[@]}"; do
    their="$(surfaces_of "$n")"
    inter="$(comm -12 <(sort <<<"$mine") <(sort <<<"$their") 2>/dev/null | grep -v '^[[:space:]]*$' || true)"
    if [ -n "$inter" ]; then
      echo "  ✗ #$n ($(title_of "$n")) — OVERLAP: $(paste -sd, - <<<"$inter")"
      reasons+=("surface overlap with #$n: $(paste -sd, - <<<"$inter")")
    else
      echo "  ✓ #$n ($(title_of "$n")) — disjoint"
    fi
    if [ "$schema_me" -eq 1 ] && grep -qiE 'schema' <<<"$their"; then
      reasons+=("schema lock held by #$n (both touch prisma/schema)")
    fi
  done
fi

echo
if [ "${#reasons[@]}" -gt 0 ]; then
  echo "VERDICT: BLOCKED"
  printf '  ✗ %s\n' "${reasons[@]}"
  [ "${#warnings[@]}" -gt 0 ] && printf '  ⚠ %s\n' "${warnings[@]}"
  exit 1
elif [ "${#warnings[@]}" -gt 0 ]; then
  echo "VERDICT: CLAIMABLE (with warnings — confirm with the human)"
  printf '  ⚠ %s\n' "${warnings[@]}"
  exit 0
else
  echo "VERDICT: CLAIMABLE"
  exit 0
fi
