CREATE TABLE "support_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "assigned_to_user_id" UUID,
    "subject" VARCHAR(200) NOT NULL,
    "category" VARCHAR(30) NOT NULL DEFAULT 'general',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "support_request_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_requests_org_id_created_at_idx" ON "support_requests"("org_id", "created_at");
CREATE INDEX "support_requests_status_priority_idx" ON "support_requests"("status", "priority");
CREATE INDEX "support_requests_assigned_to_user_id_idx" ON "support_requests"("assigned_to_user_id");
CREATE INDEX "support_messages_support_request_id_created_at_idx" ON "support_messages"("support_request_id", "created_at");
CREATE INDEX "support_messages_org_id_created_at_idx" ON "support_messages"("org_id", "created_at");

ALTER TABLE "support_requests"
ADD CONSTRAINT "support_requests_org_id_fkey"
FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_requests"
ADD CONSTRAINT "support_requests_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_requests"
ADD CONSTRAINT "support_requests_assigned_to_user_id_fkey"
FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "support_messages"
ADD CONSTRAINT "support_messages_org_id_fkey"
FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_messages"
ADD CONSTRAINT "support_messages_support_request_id_fkey"
FOREIGN KEY ("support_request_id") REFERENCES "support_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_messages"
ADD CONSTRAINT "support_messages_author_user_id_fkey"
FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
