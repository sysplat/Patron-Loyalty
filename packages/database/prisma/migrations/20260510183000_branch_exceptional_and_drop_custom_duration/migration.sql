-- Branch-wide notice for waiting customers (agent-controlled).
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "exceptional_customer_notice" BOOLEAN NOT NULL DEFAULT false;

-- Preserve per-branch duration overrides into fixed low/high pair before dropping custom_duration.
UPDATE "branch_services"
SET
  "custom_estimated_wait_margin_below_minutes" = COALESCE(
    "custom_estimated_wait_margin_below_minutes",
    "custom_duration"
  ),
  "custom_estimated_wait_margin_above_minutes" = COALESCE(
    "custom_estimated_wait_margin_above_minutes",
    "custom_duration"
  )
WHERE "custom_duration" IS NOT NULL;

ALTER TABLE "branch_services" DROP COLUMN IF EXISTS "custom_duration";
