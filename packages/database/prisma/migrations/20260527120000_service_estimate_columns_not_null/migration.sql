-- Align DB with Prisma schema: service estimate margins are required (defaults 5 / 15).
UPDATE "services"
SET
  "estimated_wait_margin_below_minutes" = COALESCE("estimated_wait_margin_below_minutes", 5),
  "estimated_wait_margin_above_minutes" = COALESCE("estimated_wait_margin_above_minutes", 15)
WHERE
  "estimated_wait_margin_below_minutes" IS NULL
  OR "estimated_wait_margin_above_minutes" IS NULL;

ALTER TABLE "services"
  ALTER COLUMN "estimated_wait_margin_below_minutes" SET DEFAULT 5,
  ALTER COLUMN "estimated_wait_margin_above_minutes" SET DEFAULT 15;

ALTER TABLE "services"
  ALTER COLUMN "estimated_wait_margin_below_minutes" SET NOT NULL,
  ALTER COLUMN "estimated_wait_margin_above_minutes" SET NOT NULL;
