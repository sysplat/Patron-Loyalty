# LMS platform admin auth audit

Patron Loyalty operators use **`https://loyalty-admin.sysplat.com`** (`apps/admin`) — separate from QMS `qplatform-admin.sysplat.com`.

Auth security events write to LMS `platform_audit_events` via `recordAuthAudit` (`packages/api/src/modules/auth/auth-security-audit.ts`).

## Operator lookup

1. Open Loyalty Admin → **Audit Trail**
2. Event type: `auth.*` (or use **Auth attempts**)
3. Actor email: paste the address the user typed (prefix match)

Never expect passwords, reset tokens, or TOTP codes in metadata — only `outcome` and safe context.

## Deploy notes

- Railway service: **pl-admin** (`railway/admin.railway.json`)
- API CORS: include `https://loyalty-admin.sysplat.com` in `APP_ALLOWED_ORIGINS` on **pl-api**
- After schema changes: `pnpm db:migrate:deploy:railway`
