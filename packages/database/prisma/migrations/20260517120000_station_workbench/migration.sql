-- Station Workbench: station profiles, queue capabilities, agent sessions

CREATE TABLE "station_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "primary_queue_id" UUID,
    "flow_template_id" UUID,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "station_profile_queues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "station_profile_id" UUID NOT NULL,
    "queue_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visibility_only" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_profile_queues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "desk_id" UUID,
    "desk_number" VARCHAR(20),
    "station_profile_id" UUID NOT NULL,
    "ended_at" TIMESTAMP(3),
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "desks" ADD COLUMN "default_station_profile_id" UUID;

CREATE UNIQUE INDEX "station_profile_queues_station_profile_id_queue_id_key" ON "station_profile_queues"("station_profile_id", "queue_id");
CREATE INDEX "station_profiles_org_id_idx" ON "station_profiles"("org_id");
CREATE INDEX "station_profiles_branch_id_idx" ON "station_profiles"("branch_id");
CREATE INDEX "station_profiles_flow_template_id_idx" ON "station_profiles"("flow_template_id");
CREATE INDEX "station_profile_queues_org_id_idx" ON "station_profile_queues"("org_id");
CREATE INDEX "station_profile_queues_queue_id_idx" ON "station_profile_queues"("queue_id");
CREATE INDEX "agent_sessions_org_id_user_id_ended_at_idx" ON "agent_sessions"("org_id", "user_id", "ended_at");
CREATE INDEX "agent_sessions_branch_id_idx" ON "agent_sessions"("branch_id");

ALTER TABLE "station_profiles" ADD CONSTRAINT "station_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "station_profiles" ADD CONSTRAINT "station_profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "station_profiles" ADD CONSTRAINT "station_profiles_primary_queue_id_fkey" FOREIGN KEY ("primary_queue_id") REFERENCES "queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "station_profiles" ADD CONSTRAINT "station_profiles_flow_template_id_fkey" FOREIGN KEY ("flow_template_id") REFERENCES "branch_flow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "station_profile_queues" ADD CONSTRAINT "station_profile_queues_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "station_profile_queues" ADD CONSTRAINT "station_profile_queues_station_profile_id_fkey" FOREIGN KEY ("station_profile_id") REFERENCES "station_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "station_profile_queues" ADD CONSTRAINT "station_profile_queues_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_desk_id_fkey" FOREIGN KEY ("desk_id") REFERENCES "desks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_station_profile_id_fkey" FOREIGN KEY ("station_profile_id") REFERENCES "station_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "desks" ADD CONSTRAINT "desks_default_station_profile_id_fkey" FOREIGN KEY ("default_station_profile_id") REFERENCES "station_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
