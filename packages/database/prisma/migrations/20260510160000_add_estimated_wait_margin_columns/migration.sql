-- Customer-facing wait range margins (optional); null = legacy automatic upper bound only.
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "estimated_wait_margin_below_minutes" INTEGER;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "estimated_wait_margin_above_minutes" INTEGER;

ALTER TABLE "branch_services" ADD COLUMN IF NOT EXISTS "custom_estimated_wait_margin_below_minutes" INTEGER;
ALTER TABLE "branch_services" ADD COLUMN IF NOT EXISTS "custom_estimated_wait_margin_above_minutes" INTEGER;
