-- Add commercial product SKU for orgs (qms | loyalty | bundle).
ALTER TABLE "organizations" ADD COLUMN "product_sku" VARCHAR(20) NOT NULL DEFAULT 'qms';
