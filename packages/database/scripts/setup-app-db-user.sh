#!/usr/bin/env bash
# Creates or updates the qms_app login role for API runtime (RLS-enforced).
# Requires DATABASE_URL pointing at a superuser (e.g. postgres) for GRANT/ALTER ROLE.
#
# Usage:
#   APP_DATABASE_PASSWORD='strong-secret' pnpm --filter @queueplatform/database setup:app-db-user
#
# Then set APP_DATABASE_URL in Railway / .env for the API service, e.g.:
#   postgresql://qms_app:strong-secret@host:5432/railway

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is required (superuser connection for role setup)." >&2
    exit 1
fi

if [[ -z "${APP_DATABASE_PASSWORD:-}" ]]; then
    echo "APP_DATABASE_PASSWORD is required." >&2
    exit 1
fi

escaped_password="${APP_DATABASE_PASSWORD//\'/\'\'}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
ALTER ROLE qms_app WITH LOGIN PASSWORD '${escaped_password}';
SQL

echo "✅ qms_app role updated. Set APP_DATABASE_URL for API runtime and keep DATABASE_URL for migrations."
