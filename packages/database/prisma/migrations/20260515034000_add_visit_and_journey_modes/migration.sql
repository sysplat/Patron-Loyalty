-- Branch default + service overrides for customer journey mode
ALTER TABLE "branches"
ADD COLUMN "default_journey_mode" VARCHAR(30) NOT NULL DEFAULT 'single_ticket';

ALTER TABLE "services"
ADD COLUMN "journey_mode_override" VARCHAR(30);

ALTER TABLE "branch_services"
ADD COLUMN "journey_mode_override" VARCHAR(30);

-- First-class visit container for multi-step customer journeys
CREATE TABLE "visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "tracking_token" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "source" VARCHAR(20) NOT NULL DEFAULT 'online',
    "customer_name" VARCHAR(100),
    "customer_phone" VARCHAR(20),
    "customer_email" VARCHAR(255),
    "language" VARCHAR(10),
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tickets"
ADD COLUMN "visit_id" UUID;

ALTER TABLE "visits"
ADD CONSTRAINT "visits_org_id_fkey"
FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visits"
ADD CONSTRAINT "visits_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_visit_id_fkey"
FOREIGN KEY ("visit_id") REFERENCES "visits"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "visits_tracking_token_key" ON "visits"("tracking_token");
CREATE INDEX "visits_org_id_idx" ON "visits"("org_id");
CREATE INDEX "visits_branch_id_idx" ON "visits"("branch_id");
CREATE INDEX "visits_org_id_status_idx" ON "visits"("org_id", "status");
CREATE INDEX "visits_org_id_created_at_idx" ON "visits"("org_id", "created_at");
CREATE INDEX "tickets_visit_id_idx" ON "tickets"("visit_id");
