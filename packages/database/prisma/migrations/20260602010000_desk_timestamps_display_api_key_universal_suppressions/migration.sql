-- Align DB with Prisma schema: desk timestamps, display device API key fields, universal suppressions.

ALTER TABLE "desks" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "desks" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "display_devices" ADD COLUMN IF NOT EXISTS "api_key_hash" VARCHAR(64);
ALTER TABLE "display_devices" ADD COLUMN IF NOT EXISTS "fingerprint_hash" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "display_devices_api_key_hash_key" ON "display_devices"("api_key_hash");

CREATE TABLE IF NOT EXISTS "universal_suppressions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID,
    "contact_hash" VARCHAR(64) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universal_suppressions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "universal_suppressions_org_id_contact_hash_channel_key"
    ON "universal_suppressions"("org_id", "contact_hash", "channel");

CREATE INDEX IF NOT EXISTS "universal_suppressions_contact_hash_channel_idx"
    ON "universal_suppressions"("contact_hash", "channel");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'universal_suppressions_org_id_fkey'
  ) THEN
    ALTER TABLE "universal_suppressions"
      ADD CONSTRAINT "universal_suppressions_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
