-- Add Stripe integration fields.
-- Other schema changes captured in the original diff were already applied to
-- production via db push and are omitted here to prevent duplicate-column errors.

-- AlterTable "organizations" -- Stripe customer ID for portal / webhook correlation
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(50);

-- AlterTable "plans" -- Stripe Price IDs (monthly + yearly) for checkout sessions
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_price_id_monthly" VARCHAR(100);
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "stripe_price_id_yearly" VARCHAR(100);

-- AlterTable "subscriptions" -- Stripe subscription tracking fields
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(100);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_price_id" VARCHAR(100);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false;
