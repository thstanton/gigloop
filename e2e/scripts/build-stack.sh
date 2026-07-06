#!/usr/bin/env sh
# Build the API + web artifacts the Playwright webServer serves (ADR-0048).
# Kept separate from the webServer commands so a cold build can't blow the
# server-start timeout, and "build broke" stays distinct from "server didn't
# come up".
set -e
cd "$(dirname "$0")/.."

# The e2e web build MUST use the same Clerk instance as the API (CLERK_SECRET_KEY)
# and the test sign-in — i.e. e2e/.env's CLERK_PUBLISHABLE_KEY — NOT the
# developer's gitignored apps/web/.env.local, which may point at a different
# instance. CI passes VITE_CLERK_PUBLISHABLE_KEY directly; locally we derive it
# from e2e/.env. (Grepping one key avoids sourcing the whole file, which would
# expand `$` in passwords/connection strings.)
if [ -z "$VITE_CLERK_PUBLISHABLE_KEY" ] && [ -f .env ]; then
  VITE_CLERK_PUBLISHABLE_KEY="$(grep -E '^CLERK_PUBLISHABLE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"')"
fi
export VITE_CLERK_PUBLISHABLE_KEY

npm run build -w @gigloop/api

# VITE_API_BASE_URL points the served web build at the e2e API (port 3100, off
# the dev port). An explicit shell var wins over apps/web/.env.local in Vite.
VITE_API_BASE_URL="http://localhost:3100/api" npm run build -w @gigloop/web
