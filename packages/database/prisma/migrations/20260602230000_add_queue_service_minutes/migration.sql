-- Queue service-time bounds drifted into schema.prisma without a migration.
-- Add them idempotently so fresh databases (CI) match environments that were
-- previously synced via db push.
ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "min_service_minutes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "max_service_minutes" INTEGER NOT NULL DEFAULT 15;
