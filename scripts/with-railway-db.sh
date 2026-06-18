#!/usr/bin/env bash
# Run a command against Railway Postgres from your machine (uses DATABASE_PUBLIC_URL).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v railway >/dev/null 2>&1; then
  echo "railway CLI is required. Install: https://docs.railway.com/guides/cli"
  exit 1
fi

JSON="$(railway variables --service Postgres --json 2>/dev/null || true)"
if [[ -z "$JSON" ]]; then
  echo "Could not read Postgres variables. Run: railway link  (project QMS, service Postgres)"
  exit 1
fi

export DATABASE_URL
DATABASE_URL="$(python3 -c "import json,sys; print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])" <<<"$JSON")"
if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_PUBLIC_URL missing on Railway Postgres service."
  exit 1
fi

if command -v psql >/dev/null 2>&1; then
  echo "Waking Railway Postgres (if sleeping)..."
  for _ in $(seq 1 45); do
    if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

exec "$@"
