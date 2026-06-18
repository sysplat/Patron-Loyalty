-- Ensure admin TOTP columns exist (idempotent; may already exist from 20260506120000_admin_two_factor).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_two_factor_secret" VARCHAR(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_two_factor_backup_hashes" JSONB;

-- Org-scoped TOTP columns may exist from db push / out-of-band; required before backfill UPDATEs.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" VARCHAR(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_backup_hashes" JSONB;

-- Move existing org-scoped TOTP on internal operators to admin-dashboard TOTP only.
UPDATE "users" AS u
SET
  "admin_two_factor_secret" = u."two_factor_secret",
  "admin_two_factor_enabled" = u."two_factor_enabled",
  "admin_two_factor_backup_hashes" = u."two_factor_backup_hashes"
FROM "organizations" AS o
WHERE u."org_id" = o."id"
  AND o."slug" = 'queueplatform-internal'
  AND u."two_factor_enabled" = true;

UPDATE "users" AS u
SET
  "two_factor_secret" = NULL,
  "two_factor_enabled" = false,
  "two_factor_backup_hashes" = NULL
FROM "organizations" AS o
WHERE u."org_id" = o."id"
  AND o."slug" = 'queueplatform-internal'
  AND u."admin_two_factor_enabled" = true;
