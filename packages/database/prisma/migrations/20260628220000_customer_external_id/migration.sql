-- Phase 3: indexed connector identity on customers (replaces metadata JSON scan).
-- Idempotent for redeploys where the column may already exist (manual migrate + Railway).

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "external_id" VARCHAR(255);

UPDATE "customers" AS c
SET "external_id" = TRIM(c.metadata->>'externalId')
WHERE c.external_id IS NULL
  AND c.metadata->>'externalId' IS NOT NULL
  AND TRIM(c.metadata->>'externalId') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "customers" AS c2
    WHERE c2.org_id = c.org_id
      AND c2.id <> c.id
      AND TRIM(c2.metadata->>'externalId') = TRIM(c.metadata->>'externalId')
  );

CREATE UNIQUE INDEX IF NOT EXISTS "customers_org_id_external_id_key" ON "customers"("org_id", "external_id");
