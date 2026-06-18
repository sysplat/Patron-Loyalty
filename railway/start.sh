#!/bin/bash
set -e

echo "🚀 Starting service for SERVICE_TYPE: $SERVICE_TYPE"

if [ "$SERVICE_TYPE" == "api" ]; then
  pnpm --filter @queueplatform/database exec prisma migrate deploy
  pnpm --filter @queueplatform/api exec tsx scripts/bootstrap-platform-staff.ts
  node packages/api/dist/main.js
elif [ "$SERVICE_TYPE" == "web" ]; then
  pnpm --filter @queueplatform/web start
elif [ "$SERVICE_TYPE" == "admin" ]; then
  pnpm --filter @queueplatform/admin start
elif [ "$SERVICE_TYPE" == "notifications" ]; then
  node packages/notifications/dist/index.js
else
  echo "❌ Error: SERVICE_TYPE not set or unknown ($SERVICE_TYPE). Cannot start."
  exit 1
fi
