-- Optional minute hint for the branch-wide exceptional customer notice.
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "exceptional_customer_notice_minutes" INTEGER;
