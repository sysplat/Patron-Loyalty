#!/usr/bin/env sh
# Production migrate: clear known failed rows (idempotent migrations), then deploy.
set -e
cd "$(dirname "$0")/.."

RECOVER_FAILED_MIGRATIONS="${RECOVER_FAILED_MIGRATIONS:-20260516113000_add_flow_templates_and_ready_policies 20260506120000_admin_two_factor 20260518122500_enterprise_announcements_foundation 20260518203000_journey_external_ref_required 20260519130000_workbench_stations_and_session_surface}"

for migration in $RECOVER_FAILED_MIGRATIONS; do
  echo "Recovering failed migration (if any): $migration"
  timeout 45 npx prisma migrate resolve --rolled-back "$migration" 2>/dev/null || true
done

echo "Applying migrations..."
exec npx prisma migrate deploy
