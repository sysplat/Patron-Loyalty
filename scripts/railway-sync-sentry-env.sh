#!/usr/bin/env bash
# Sync Sentry-related variables from repo root .env to Railway services.
# Usage: ./scripts/railway-sync-sentry-env.sh
# Requires: railway CLI linked to the QMS project; SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN in .env

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
SENTRY_TEST_SECRET="$(read_var SENTRY_TEST_SECRET || true)"

if [[ -z "$SENTRY_DSN" ]]; then
  echo "SENTRY_DSN is not set in .env — skipping Railway sync." >&2
  exit 0
fi

set_service_vars() {
  local service="$1"
  echo "Updating ${service}..."
  railway variables --service "$service" set "SENTRY_DSN=${SENTRY_DSN}" >/dev/null
  if [[ -n "$PUBLIC_DSN" && "$service" == "qms-web" ]]; then
    railway variables --service "$service" set "NEXT_PUBLIC_SENTRY_DSN=${PUBLIC_DSN}" >/dev/null
  fi
  if [[ -n "$SENTRY_ORG" && "$service" == "qms-web" ]]; then
    railway variables --service "$service" set "SENTRY_ORG=${SENTRY_ORG}" >/dev/null
  fi
  if [[ -n "$SENTRY_PROJECT" && "$service" == "qms-web" ]]; then
    railway variables --service "$service" set "SENTRY_PROJECT=${SENTRY_PROJECT}" >/dev/null
  fi
  if [[ -n "$SENTRY_AUTH_TOKEN" && "$service" == "qms-web" ]]; then
    railway variables --service "$service" set "SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}" >/dev/null
  fi
  if [[ -n "$SENTRY_TEST_SECRET" && "$service" == "qms-api" ]]; then
    railway variables --service "$service" set "SENTRY_TEST_SECRET=${SENTRY_TEST_SECRET}" >/dev/null
  fi
}

for svc in qms-api qms-web qms-notifications; do
  set_service_vars "$svc"
done

echo "Done. Redeploy qms-api, qms-web, and qms-notifications for changes to take effect."
