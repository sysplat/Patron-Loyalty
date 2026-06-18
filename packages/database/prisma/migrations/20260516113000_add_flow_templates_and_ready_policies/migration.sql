-- Idempotent: safe when columns/tables were partially applied (e.g. failed deploy or prior db push).

ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "step_role" VARCHAR(30);
ALTER TABLE "queues" ADD COLUMN IF NOT EXISTS "flow_template_id" UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'queues'
          AND column_name = 'calling_policy'
    ) THEN
        ALTER TABLE "queues"
        ADD COLUMN "calling_policy" VARCHAR(30) NOT NULL DEFAULT 'fifo';
    END IF;
END $$;

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "ready_at" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "step_index" INTEGER;

CREATE TABLE IF NOT EXISTS "branch_flow_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branch_flow_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "branch_flow_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "step_index" INTEGER NOT NULL,
    "service_id" UUID NOT NULL,
    "queue_id" UUID NOT NULL,
    "step_role" VARCHAR(30) NOT NULL,
    "calling_policy" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branch_flow_steps_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'queues_flow_template_id_fkey'
    ) THEN
        ALTER TABLE "queues"
        ADD CONSTRAINT "queues_flow_template_id_fkey"
        FOREIGN KEY ("flow_template_id") REFERENCES "branch_flow_templates"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'branch_flow_templates_org_id_fkey'
    ) THEN
        ALTER TABLE "branch_flow_templates"
        ADD CONSTRAINT "branch_flow_templates_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'branch_flow_templates_branch_id_fkey'
    ) THEN
        ALTER TABLE "branch_flow_templates"
        ADD CONSTRAINT "branch_flow_templates_branch_id_fkey"
        FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'branch_flow_steps_org_id_fkey'
    ) THEN
        ALTER TABLE "branch_flow_steps"
        ADD CONSTRAINT "branch_flow_steps_org_id_fkey"
        FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'branch_flow_steps_template_id_fkey'
    ) THEN
        ALTER TABLE "branch_flow_steps"
        ADD CONSTRAINT "branch_flow_steps_template_id_fkey"
        FOREIGN KEY ("template_id") REFERENCES "branch_flow_templates"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'branch_flow_steps_service_id_fkey'
    ) THEN
        ALTER TABLE "branch_flow_steps"
        ADD CONSTRAINT "branch_flow_steps_service_id_fkey"
        FOREIGN KEY ("service_id") REFERENCES "services"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'branch_flow_steps_queue_id_fkey'
    ) THEN
        ALTER TABLE "branch_flow_steps"
        ADD CONSTRAINT "branch_flow_steps_queue_id_fkey"
        FOREIGN KEY ("queue_id") REFERENCES "queues"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "branch_flow_templates_branch_id_name_key"
ON "branch_flow_templates"("branch_id", "name");

CREATE INDEX IF NOT EXISTS "branch_flow_templates_org_id_idx"
ON "branch_flow_templates"("org_id");

CREATE INDEX IF NOT EXISTS "branch_flow_templates_branch_id_idx"
ON "branch_flow_templates"("branch_id");

CREATE INDEX IF NOT EXISTS "branch_flow_templates_branch_id_is_active_idx"
ON "branch_flow_templates"("branch_id", "is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "branch_flow_steps_template_id_step_index_key"
ON "branch_flow_steps"("template_id", "step_index");

CREATE UNIQUE INDEX IF NOT EXISTS "branch_flow_steps_template_id_queue_id_key"
ON "branch_flow_steps"("template_id", "queue_id");

CREATE INDEX IF NOT EXISTS "branch_flow_steps_org_id_idx"
ON "branch_flow_steps"("org_id");

CREATE INDEX IF NOT EXISTS "branch_flow_steps_template_id_idx"
ON "branch_flow_steps"("template_id");

CREATE INDEX IF NOT EXISTS "branch_flow_steps_queue_id_idx"
ON "branch_flow_steps"("queue_id");

CREATE INDEX IF NOT EXISTS "queues_flow_template_id_idx"
ON "queues"("flow_template_id");

CREATE INDEX IF NOT EXISTS "tickets_queue_id_status_ready_at_priority_booked_at_idx"
ON "tickets"("queue_id", "status", "ready_at", "priority", "booked_at");
