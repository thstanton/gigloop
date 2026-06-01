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

if printf '%s\n' "$changed" | grep -q '^apps/api/'; then
  (cd apps/api && bun run test && bun run build) || status=1
fi
if printf '%s\n' "$changed" | grep -q '^apps/web/'; then
  (cd apps/web && bun run test && bun run build) || status=1
fi

exit $status
