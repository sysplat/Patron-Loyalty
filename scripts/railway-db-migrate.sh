#!/usr/bin/env bash
set -euo pipefail
# Run database migrations as a dedicated release step (before scaling API replicas).
echo "[railway-db-migrate] Applying Prisma migrations..."
pnpm --filter @queueplatform/database db:migrate:deploy
echo "[railway-db-migrate] Done."
