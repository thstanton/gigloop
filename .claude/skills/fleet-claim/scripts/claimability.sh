#!/usr/bin/env bash
# claimability.sh <issue> — fleet claim precheck (docs/agents/fleet.md).
#
# Prints the in-flight map, extracts each issue's declared Surfaces, and reports
# whether <issue> can be claimed: surfaces disjoint from every in-flight claim,
# a free WIP slot, and a free schema lock.
#
# Surface parsing is HEURISTIC — it pulls `backticked` tokens from any line
# mentioning "surface" in the issue body or its comments. Treat the verdict as
# advice: sanity-check it against the codebase before trusting it.
set -uo pipefail

WIP_CAP=3
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

title_of() { gh issue view "$1" --json title --jq .title 2>/dev/null || echo "?"; }

mine="$(surfaces_of "$issue")"
inflight=()
while IFS= read -r _n; do [ -n "$_n" ] && inflight+=("$_n"); done < <(
  gh issue list --label in-progress --state open --json number --jq '.[].number' 2>/dev/null \
  | grep -vx "$issue" || true)
wip=${#inflight[@]}

echo "═══ Claimability precheck for #$issue ($(title_of "$issue")) ═══"
echo
echo "Declared surfaces for #$issue:"
if [ -n "$mine" ]; then sed 's/^/  • /' <<<"$mine"; else echo "  (none found)"; fi
echo
echo "In-flight (other in-progress issues): $wip   |   WIP cap: $WIP_CAP"

reasons=()

# WIP cap: claiming adds this issue; total must stay ≤ cap.
[ "$wip" -ge "$WIP_CAP" ] && reasons+=("WIP cap reached ($wip in-flight ≥ $WIP_CAP)")

# Missing surfaces → cannot verify disjointness.
[ -z "$mine" ] && reasons+=("no Surfaces declared on #$issue — cannot verify disjointness")

schema_me=0; grep -qiE 'schema' <<<"$mine" && schema_me=1

echo
echo "Surface disjointness vs each in-flight claim:"
if [ "$wip" -eq 0 ]; then
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
if [ "${#reasons[@]}" -eq 0 ]; then
  echo "VERDICT: CLAIMABLE"
  exit 0
else
  echo "VERDICT: BLOCKED"
  printf '  - %s\n' "${reasons[@]}"
  exit 1
fi
