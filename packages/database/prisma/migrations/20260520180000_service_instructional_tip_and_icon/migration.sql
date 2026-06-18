-- Service display fields referenced by Prisma schema (instructionalTip, icon).

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "instructional_tip" VARCHAR(500);
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(50);
