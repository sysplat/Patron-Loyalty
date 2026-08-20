-- CreateTable
CREATE TABLE "loyalty_pos_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "webhook_signature_key" VARCHAR(500) NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_pos_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_marketing_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "credentials" JSONB NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_marketing_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_pos_connections_org_id_provider_key" ON "loyalty_pos_connections"("org_id", "provider");

-- CreateIndex
CREATE INDEX "loyalty_pos_connections_org_id_idx" ON "loyalty_pos_connections"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_marketing_connections_org_id_provider_key" ON "loyalty_marketing_connections"("org_id", "provider");

-- CreateIndex
CREATE INDEX "loyalty_marketing_connections_org_id_idx" ON "loyalty_marketing_connections"("org_id");

-- AddForeignKey
ALTER TABLE "loyalty_pos_connections" ADD CONSTRAINT "loyalty_pos_connections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_marketing_connections" ADD CONSTRAINT "loyalty_marketing_connections_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
