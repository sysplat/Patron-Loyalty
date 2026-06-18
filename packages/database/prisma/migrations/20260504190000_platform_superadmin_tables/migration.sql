-- Platform operator: audit trail, org health telemetry, export jobs

CREATE TABLE "platform_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_email" VARCHAR(255),
    "event_type" VARCHAR(100) NOT NULL,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'info',
    "subject_org_id" UUID,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    CONSTRAINT "platform_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_audit_events_created_at_idx" ON "platform_audit_events" ("created_at" DESC);
CREATE INDEX "platform_audit_events_event_type_created_at_idx" ON "platform_audit_events" ("event_type", "created_at" DESC);

CREATE TABLE "org_health_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "org_health_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "org_health_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "org_health_snapshots_org_id_computed_at_idx" ON "org_health_snapshots" ("org_id", "computed_at" DESC);
CREATE INDEX "org_health_snapshots_status_computed_at_idx" ON "org_health_snapshots" ("status", "computed_at" DESC);

CREATE TABLE "platform_export_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "result_key" VARCHAR(500),
    "error_message" TEXT,
    "metadata" JSONB,
    CONSTRAINT "platform_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_export_jobs_status_created_at_idx" ON "platform_export_jobs" ("status", "created_at" DESC);
