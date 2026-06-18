-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "marketing_consent_source" VARCHAR(30),
ADD COLUMN     "marketing_consent_version" VARCHAR(30),
ADD COLUMN     "marketing_email_consent" VARCHAR(30) NOT NULL DEFAULT 'REVOKED',
ADD COLUMN     "marketing_sms_consent" VARCHAR(30) NOT NULL DEFAULT 'REVOKED';

-- CreateTable
CREATE TABLE "consent_ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "channel" VARCHAR(10) NOT NULL,
    "purpose" VARCHAR(30) NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "legal_version" VARCHAR(30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_ledger_entries_org_id_customer_id_idx" ON "consent_ledger_entries"("org_id", "customer_id");

-- CreateIndex
CREATE INDEX "consent_ledger_entries_customer_id_channel_purpose_idx" ON "consent_ledger_entries"("customer_id", "channel", "purpose");

-- AddForeignKey
ALTER TABLE "consent_ledger_entries" ADD CONSTRAINT "consent_ledger_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_ledger_entries" ADD CONSTRAINT "consent_ledger_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
