#!/usr/bin/env sh
# Pre-commit gate (ADR-0030): lint ONLY the workspace(s) with staged changes.
# Fast and blocking. Docs-only commits touch neither workspace and pass instantly.
set -u

staged=$(git diff --cached --name-only)
status=0

if printf '%s\n' "$staged" | grep -q '^apps/api/'; then
  (cd apps/api && bun run lint) || status=1
fi
if printf '%s\n' "$staged" | grep -q '^apps/web/'; then
  (cd apps/web && bun run lint) || status=1
fi

exit $status
