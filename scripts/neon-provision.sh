#!/usr/bin/env bash
# Creates an ephemeral Neon branch for the integration test run.
# Outputs DATABASE_URL to $GITHUB_ENV and branch ID to $GITHUB_OUTPUT.
# Required env vars: NEON_API_KEY, NEON_PROJECT_ID
set -euo pipefail

BRANCH_NAME="ci-integration-${GITHUB_RUN_ID:-local-$$}"

echo "Creating Neon branch: $BRANCH_NAME"

BRANCH_RESPONSE=$(curl -sf \
  -X POST \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches" \
  -d "{\"branch\": {\"name\": \"$BRANCH_NAME\"}, \"endpoints\": [{\"type\": \"read_write\"}]}")

BRANCH_ID=$(echo "$BRANCH_RESPONSE" | jq -r '.branch.id')
echo "Branch created: $BRANCH_ID"

# Fetch the full connection URI (includes password for neondb_owner role)
URI_RESPONSE=$(curl -sf \
  -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/connection_uri?branch_id=$BRANCH_ID&role_name=neondb_owner&database_name=neondb")

DATABASE_URL=$(echo "$URI_RESPONSE" | jq -r '.uri')

echo "NEON_BRANCH_ID=$BRANCH_ID" >> "$GITHUB_OUTPUT"
echo "DATABASE_URL=$DATABASE_URL" >> "$GITHUB_ENV"
echo "Branch ready."
