/*
  Warnings:

  - Added the required column `updated_at` to the `customers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "address_line1" VARCHAR(255),
ADD COLUMN     "birthday" DATE,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "country" VARCHAR(2),
ADD COLUMN     "gender" VARCHAR(20),
ADD COLUMN     "postal_code" VARCHAR(20),
ADD COLUMN     "region" VARCHAR(100),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "customers" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "points_currency_name" VARCHAR(50) NOT NULL DEFAULT 'Points',
    "default_earn_points" INTEGER NOT NULL DEFAULT 10,
    "referral_bonus_points" INTEGER NOT NULL DEFAULT 50,
    "referred_bonus_points" INTEGER NOT NULL DEFAULT 25,
    "points_expiry_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(30) NOT NULL,
    "min_lifetime_points" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "color" VARCHAR(20),
    "benefits" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "tier_id" UUID,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points_earned" INTEGER NOT NULL DEFAULT 0,
    "lifetime_points_burned" INTEGER NOT NULL DEFAULT 0,
    "referral_code" VARCHAR(20) NOT NULL,
    "total_visits" INTEGER NOT NULL DEFAULT 0,
    "lifetime_value_cents" INTEGER NOT NULL DEFAULT 0,
    "health_score" INTEGER NOT NULL DEFAULT 50,
    "churn_risk" VARCHAR(20) NOT NULL DEFAULT 'low',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_point_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "points" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "source_type" VARCHAR(30),
    "source_id" UUID,
    "description" VARCHAR(500),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_point_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rewards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "type" VARCHAR(30) NOT NULL DEFAULT 'DISCOUNT',
    "points_cost" INTEGER NOT NULL,
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "image_url" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "points_spent" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilled_at" TIMESTAMP(3),

    CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'PERCENT',
    "value" INTEGER NOT NULL,
    "min_purchase_cents" INTEGER,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "tier_slugs" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_coupon_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "balance_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_wallet_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" VARCHAR(500),
    "source_type" VARCHAR(30),
    "source_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "referrer_account_id" UUID NOT NULL,
    "referred_customer_id" UUID NOT NULL,
    "referred_account_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "referrer_bonus_points" INTEGER NOT NULL DEFAULT 0,
    "referred_bonus_points" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_earn_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(40) NOT NULL,
    "points" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_earn_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "trigger" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "subject" VARCHAR(200),
    "body" TEXT,
    "segment_preset" VARCHAR(50),
    "scheduled_at" TIMESTAMP(3),
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_campaign_sends" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "sent_at" TIMESTAMP(3),
    "error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_campaign_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(50),
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "target_type" VARCHAR(30) NOT NULL,
    "target_value" INTEGER NOT NULL,
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_challenge_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "customer_challenge_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_gift_cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "initial_balance_cents" INTEGER NOT NULL,
    "balance_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "purchaser_account_id" UUID,
    "recipient_email" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "due_at" TIMESTAMP(3),
    "assignee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_org_id_key" ON "loyalty_programs"("org_id");

-- CreateIndex
CREATE INDEX "loyalty_tiers_org_id_program_id_idx" ON "loyalty_tiers"("org_id", "program_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_tiers_org_id_slug_key" ON "loyalty_tiers"("org_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_customer_id_key" ON "loyalty_accounts"("customer_id");

-- CreateIndex
CREATE INDEX "loyalty_accounts_org_id_idx" ON "loyalty_accounts"("org_id");

-- CreateIndex
CREATE INDEX "loyalty_accounts_org_id_tier_id_idx" ON "loyalty_accounts"("org_id", "tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_org_id_referral_code_key" ON "loyalty_accounts"("org_id", "referral_code");

-- CreateIndex
CREATE INDEX "loyalty_point_ledger_org_id_account_id_created_at_idx" ON "loyalty_point_ledger"("org_id", "account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "loyalty_point_ledger_account_id_type_idx" ON "loyalty_point_ledger"("account_id", "type");

-- CreateIndex
CREATE INDEX "loyalty_rewards_org_id_active_idx" ON "loyalty_rewards"("org_id", "active");

-- CreateIndex
CREATE INDEX "loyalty_redemptions_org_id_account_id_idx" ON "loyalty_redemptions"("org_id", "account_id");

-- CreateIndex
CREATE INDEX "loyalty_coupons_org_id_active_idx" ON "loyalty_coupons"("org_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_coupons_org_id_code_key" ON "loyalty_coupons"("org_id", "code");

-- CreateIndex
CREATE INDEX "loyalty_coupon_redemptions_org_id_coupon_id_idx" ON "loyalty_coupon_redemptions"("org_id", "coupon_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_wallets_account_id_key" ON "loyalty_wallets"("account_id");

-- CreateIndex
CREATE INDEX "loyalty_wallets_org_id_idx" ON "loyalty_wallets"("org_id");

-- CreateIndex
CREATE INDEX "loyalty_wallet_transactions_org_id_wallet_id_created_at_idx" ON "loyalty_wallet_transactions"("org_id", "wallet_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_referrals_referred_account_id_key" ON "loyalty_referrals"("referred_account_id");

-- CreateIndex
CREATE INDEX "loyalty_referrals_org_id_referrer_account_id_idx" ON "loyalty_referrals"("org_id", "referrer_account_id");

-- CreateIndex
CREATE INDEX "loyalty_earn_rules_org_id_event_type_active_idx" ON "loyalty_earn_rules"("org_id", "event_type", "active");

-- CreateIndex
CREATE INDEX "loyalty_campaigns_org_id_status_idx" ON "loyalty_campaigns"("org_id", "status");

-- CreateIndex
CREATE INDEX "loyalty_campaign_sends_org_id_campaign_id_idx" ON "loyalty_campaign_sends"("org_id", "campaign_id");

-- CreateIndex
CREATE INDEX "loyalty_badges_org_id_active_idx" ON "loyalty_badges"("org_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "customer_badges_account_id_badge_id_key" ON "customer_badges"("account_id", "badge_id");

-- CreateIndex
CREATE INDEX "loyalty_challenges_org_id_active_idx" ON "loyalty_challenges"("org_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "customer_challenge_progress_account_id_challenge_id_key" ON "customer_challenge_progress"("account_id", "challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_gift_cards_org_id_code_key" ON "loyalty_gift_cards"("org_id", "code");

-- CreateIndex
CREATE INDEX "crm_tasks_org_id_customer_id_idx" ON "crm_tasks"("org_id", "customer_id");

-- CreateIndex
CREATE INDEX "crm_tasks_org_id_status_due_at_idx" ON "crm_tasks"("org_id", "status", "due_at");

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tiers" ADD CONSTRAINT "loyalty_tiers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tiers" ADD CONSTRAINT "loyalty_tiers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "loyalty_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_point_ledger" ADD CONSTRAINT "loyalty_point_ledger_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "loyalty_rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_coupons" ADD CONSTRAINT "loyalty_coupons_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_coupon_redemptions" ADD CONSTRAINT "loyalty_coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "loyalty_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_coupon_redemptions" ADD CONSTRAINT "loyalty_coupon_redemptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_wallets" ADD CONSTRAINT "loyalty_wallets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_wallet_transactions" ADD CONSTRAINT "loyalty_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "loyalty_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_referrals" ADD CONSTRAINT "loyalty_referrals_referrer_account_id_fkey" FOREIGN KEY ("referrer_account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_referrals" ADD CONSTRAINT "loyalty_referrals_referred_account_id_fkey" FOREIGN KEY ("referred_account_id") REFERENCES "loyalty_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_earn_rules" ADD CONSTRAINT "loyalty_earn_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_earn_rules" ADD CONSTRAINT "loyalty_earn_rules_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_campaigns" ADD CONSTRAINT "loyalty_campaigns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_campaign_sends" ADD CONSTRAINT "loyalty_campaign_sends_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "loyalty_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_campaign_sends" ADD CONSTRAINT "loyalty_campaign_sends_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_badges" ADD CONSTRAINT "loyalty_badges_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_badges" ADD CONSTRAINT "customer_badges_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_badges" ADD CONSTRAINT "customer_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "loyalty_badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_challenges" ADD CONSTRAINT "loyalty_challenges_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_challenge_progress" ADD CONSTRAINT "customer_challenge_progress_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_challenge_progress" ADD CONSTRAINT "customer_challenge_progress_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "loyalty_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_gift_cards" ADD CONSTRAINT "loyalty_gift_cards_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_gift_cards" ADD CONSTRAINT "loyalty_gift_cards_purchaser_account_id_fkey" FOREIGN KEY ("purchaser_account_id") REFERENCES "loyalty_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
