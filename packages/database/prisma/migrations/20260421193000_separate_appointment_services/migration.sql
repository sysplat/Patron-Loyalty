-- AlterTable: add appointment-specific service controls
ALTER TABLE "services"
    ADD COLUMN "queue_enabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "appointment_enabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "appointment_slot_interval" INTEGER,
    ADD COLUMN "appointment_lead_time_minutes" INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN "appointment_max_advance_days" INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN "appointment_buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "appointment_requires_email" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: preserve existing appointment-capable services
UPDATE "services"
SET "appointment_enabled" = true
WHERE "id" IN (
    SELECT DISTINCT "service_id" FROM "appointments"
    UNION
    SELECT DISTINCT "service_id" FROM "sub_services"
);
