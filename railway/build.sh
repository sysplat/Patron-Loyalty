#!/bin/bash
set -e

echo "🚀 Starting build for SERVICE_TYPE: $SERVICE_TYPE"

if [ "$SERVICE_TYPE" == "api" ]; then
  pnpm install --frozen-lockfile && pnpm --filter @queueplatform/database db:generate && pnpm --filter @queueplatform/api build
elif [ "$SERVICE_TYPE" == "web" ]; then
  pnpm install --frozen-lockfile && pnpm --filter @queueplatform/web build
elif [ "$SERVICE_TYPE" == "admin" ]; then
  pnpm install --frozen-lockfile && pnpm --filter @queueplatform/admin build
elif [ "$SERVICE_TYPE" == "notifications" ]; then
  pnpm install --frozen-lockfile && pnpm --filter @queueplatform/database db:generate && pnpm --filter @queueplatform/notifications build
else
  echo "⚠️ Unknown or missing SERVICE_TYPE. Falling back to default pnpm install."
  pnpm install --frozen-lockfile
fi
