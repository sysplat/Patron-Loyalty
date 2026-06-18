-- Platform admin (queueplatform-internal operators) TOTP 2FA
-- IF NOT EXISTS: safe when columns were created out-of-band or a prior deploy partially applied.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_two_factor_secret" VARCHAR(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_two_factor_backup_hashes" JSONB;
