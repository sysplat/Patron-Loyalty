#!/usr/bin/env bash
# Sync Sentry-related variables from repo root .env to Patron Loyalty Railway services.
# Usage: ./scripts/railway-sync-sentry-env.sh
# Requires: railway CLI linked to the Patron Loyalty project; SENTRY_DSN in .env

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Add SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN first." >&2
  exit 1
fi

read_var() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

SENTRY_DSN="$(read_var SENTRY_DSN || true)"
PUBLIC_DSN="$(read_var NEXT_PUBLIC_SENTRY_DSN || true)"
SENTRY_ORG="$(read_var SENTRY_ORG || true)"
SENTRY_PROJECT="$(read_var SENTRY_PROJECT || true)"
SENTRY_AUTH_TOKEN="$(read_var SENTRY_AUTH_TOKEN || true)"

if [[ -z "$SENTRY_DSN" ]]; then
  echo "SENTRY_DSN is not set in .env — skipping Railway sync." >&2
  echo "Set SENTRY_DSN in .env, or configure manually in Railway UI (pl-api → Variables):" >&2
  echo "  SENTRY_DSN=<your-dsn>" >&2
  echo "  SENTRY_RELEASE=\${{RAILWAY_GIT_COMMIT_SHA}}" >&2
  exit 0
fi

set_service_vars() {
  local service="$1"
  echo "Updating ${service}..."
  railway variables --service "$service" set "SENTRY_DSN=${SENTRY_DSN}" >/dev/null
  railway variables --service "$service" set 'SENTRY_RELEASE=${{RAILWAY_GIT_COMMIT_SHA}}' >/dev/null
  if [[ -n "$PUBLIC_DSN" && "$service" == "pl-loyalty" ]]; then
    railway variables --service "$service" set "NEXT_PUBLIC_SENTRY_DSN=${PUBLIC_DSN}" >/dev/null
  fi
  if [[ -n "$SENTRY_ORG" && "$service" == "pl-loyalty" ]]; then
    railway variables --service "$service" set "SENTRY_ORG=${SENTRY_ORG}" >/dev/null
  fi
  if [[ -n "$SENTRY_PROJECT" && "$service" == "pl-loyalty" ]]; then
    railway variables --service "$service" set "SENTRY_PROJECT=${SENTRY_PROJECT}" >/dev/null
  fi
  if [[ -n "$SENTRY_AUTH_TOKEN" && "$service" == "pl-loyalty" ]]; then
    railway variables --service "$service" set "SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}" >/dev/null
  fi
}

for svc in pl-api pl-loyalty; do
  set_service_vars "$svc"
done

echo "Done. Redeploy pl-api and pl-loyalty for changes to take effect."
echo "Verify: node scripts/verify-sentry-prod.mjs"
