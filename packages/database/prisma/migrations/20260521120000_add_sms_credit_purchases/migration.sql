-- CreateTable
CREATE TABLE "sms_credit_purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "pack_slug" VARCHAR(30) NOT NULL,
    "messages" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "stripe_checkout_session_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "sms_credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sms_credit_purchases_stripe_checkout_session_id_key" ON "sms_credit_purchases"("stripe_checkout_session_id");

-- CreateIndex
CREATE INDEX "sms_credit_purchases_org_id_idx" ON "sms_credit_purchases"("org_id");

-- CreateIndex
CREATE INDEX "sms_credit_purchases_org_id_status_idx" ON "sms_credit_purchases"("org_id", "status");

-- AddForeignKey
ALTER TABLE "sms_credit_purchases" ADD CONSTRAINT "sms_credit_purchases_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
