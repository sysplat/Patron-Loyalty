-- Patron experience branding: org colors + program display name
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "brand_primary_color" VARCHAR(7);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "brand_accent_color" VARCHAR(7);
ALTER TABLE "loyalty_programs" ADD COLUMN IF NOT EXISTS "display_name" VARCHAR(100);
