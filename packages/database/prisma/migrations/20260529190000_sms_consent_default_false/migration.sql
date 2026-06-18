-- Align DB defaults with explicit opt-in SMS consent (CASL/PIPEDA model).
-- Existing rows are unchanged; only the column default for new inserts is updated.

ALTER TABLE "tickets" ALTER COLUMN "transactional_sms_allowed" SET DEFAULT false;
ALTER TABLE "customers" ALTER COLUMN "transactional_sms_allowed" SET DEFAULT false;
