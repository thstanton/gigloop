#!/usr/bin/env sh
# Pre-commit gate (ADR-0030): lint ONLY the workspace(s) with staged changes.
# Fast and blocking. Docs-only commits touch neither workspace and pass instantly.
set -u

ROOT=$(git rev-parse --show-toplevel)
staged=$(git diff --cached --name-only)
status=0

# Shortcut-detector: unconditional — lowered-bar patterns can land in any file.
git diff --cached | node "$ROOT/scripts/shortcut-detector.mjs" || status=1

# Use npm run for scripts (not bun run): npm delegates to the system Node.js,
# avoiding bun runtime compatibility gaps (e.g. util.styleText). Bun remains
# the install-time package manager (bun add) to avoid lockfile conflicts.
if printf '%s\n' "$staged" | grep -q '^apps/api/'; then
  (cd apps/api && npm run lint) || status=1
fi
if printf '%s\n' "$staged" | grep -q '^apps/web/'; then
  (cd apps/web && npm run lint) || status=1
fi

exit $status
