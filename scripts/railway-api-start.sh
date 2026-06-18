#!/usr/bin/env bash
set -euo pipefail
# API process entrypoint. Migrations are opt-in so multi-replica deploys do not race.
if [[ "${RUN_DB_MIGRATIONS_ON_START:-false}" == "true" ]]; then
  echo "[railway-api-start] RUN_DB_MIGRATIONS_ON_START=true — running migrations (single-replica only)."
  pnpm --filter @queueplatform/database db:migrate:deploy
fi
exec node packages/api/dist/main.js
