#!/usr/bin/env bash
# Deletes the ephemeral Neon branch created by neon-provision.sh.
# Required env vars: NEON_API_KEY, NEON_PROJECT_ID
# Required input: NEON_BRANCH_ID (from the provision step output)
set -euo pipefail

if [[ -z "${NEON_BRANCH_ID:-}" ]]; then
  echo "NEON_BRANCH_ID not set — skipping teardown"
  exit 0
fi

echo "Deleting Neon branch: $NEON_BRANCH_ID"

curl -sf \
  -X DELETE \
  -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches/$NEON_BRANCH_ID"

echo "Branch deleted."
