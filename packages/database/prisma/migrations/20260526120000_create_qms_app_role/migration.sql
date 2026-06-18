-- Application runtime role: non-superuser so PostgreSQL RLS policies apply.
-- Prisma migrations and admin tasks should keep using the superuser DATABASE_URL.
-- After deploy, run: pnpm --filter @queueplatform/database setup:app-db-user
-- Then point the API runtime at APP_DATABASE_URL (qms_app) instead of postgres.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qms_app') THEN
        CREATE ROLE qms_app NOINHERIT;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO qms_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qms_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO qms_app;
