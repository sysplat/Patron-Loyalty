-- CreateTable
CREATE TABLE "legal_acceptances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "document_type" VARCHAR(30) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_acceptances_account_id_idx" ON "legal_acceptances"("account_id");

-- CreateIndex
CREATE INDEX "legal_acceptances_account_id_document_type_idx" ON "legal_acceptances"("account_id", "document_type");

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
