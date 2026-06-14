#!/usr/bin/env sh
# Pre-push gate (ADR-0030): test + build ONLY the workspace(s) changed on this branch.
# build subsumes typecheck. CI re-runs everything on both apps as the backstop.
set -u

base=$(git merge-base origin/main HEAD 2>/dev/null || echo "")
if [ -n "$base" ]; then
  changed=$(git diff --name-only "$base" HEAD)
else
  changed=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
fi
status=0

# Use npm run for scripts (not bun run): npm delegates to the system Node.js,
# avoiding bun runtime compatibility gaps (e.g. util.styleText). Bun remains
# the install-time package manager (bun add) to avoid lockfile conflicts.
if printf '%s\n' "$changed" | grep -q '^apps/api/'; then
  (cd apps/api && npm run test && npm run build) || status=1
fi
if printf '%s\n' "$changed" | grep -q '^apps/web/'; then
  (cd apps/web && npm run test && npm run build) || status=1
fi

exit $status
