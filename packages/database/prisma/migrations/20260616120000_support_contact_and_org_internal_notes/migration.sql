-- Org primary contact for vendor replies + org-internal coordination notes.
ALTER TABLE "support_requests" ADD COLUMN "contact_user_id" UUID;

UPDATE "support_requests"
SET "contact_user_id" = "created_by_user_id"
WHERE "contact_user_id" IS NULL;

ALTER TABLE "support_requests" ALTER COLUMN "contact_user_id" SET NOT NULL;

ALTER TABLE "support_requests"
ADD CONSTRAINT "support_requests_contact_user_id_fkey"
FOREIGN KEY ("contact_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "support_requests_contact_user_id_idx" ON "support_requests"("contact_user_id");

ALTER TABLE "support_messages"
ADD COLUMN "is_org_internal" BOOLEAN NOT NULL DEFAULT false;
