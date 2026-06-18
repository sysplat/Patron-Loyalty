-- Workbench stations for journey serve (separate from lobby display desks)
-- Agent session surface splits classic single-step vs journey multi-step contexts
-- Idempotent: safe to re-run after a failed partial apply (P3009 recovery).

CREATE TABLE IF NOT EXISTS "workbench_stations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workbench_stations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workbench_stations_branch_id_number_key" ON "workbench_stations"("branch_id", "number");
CREATE INDEX IF NOT EXISTS "workbench_stations_org_id_idx" ON "workbench_stations"("org_id");
CREATE INDEX IF NOT EXISTS "workbench_stations_branch_id_idx" ON "workbench_stations"("branch_id");

DO $$ BEGIN
    ALTER TABLE "workbench_stations" ADD CONSTRAINT "workbench_stations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "workbench_stations" ADD CONSTRAINT "workbench_stations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "workbench_station_id" UUID;
ALTER TABLE "agent_sessions" ADD COLUMN IF NOT EXISTS "surface" VARCHAR(20) NOT NULL DEFAULT 'classic';

DO $$ BEGIN
    ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_workbench_station_id_fkey" FOREIGN KEY ("workbench_station_id") REFERENCES "workbench_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
