# LMS platform admin auth audit

Patron Loyalty operators use **`https://loyalty-admin.sysplat.com`** (`apps/admin`) — separate from QMS `qplatform-admin.sysplat.com`.

Auth security events write to LMS `platform_audit_events` via `recordAuthAudit` (`packages/api/src/modules/auth/auth-security-audit.ts`). Event catalog matches QPlatform.

## Operator lookup

1. Open Loyalty Admin → **Audit Trail**
2. Event type: `auth.*` (or use **Auth attempts**)
3. Actor email: paste the address the user typed (prefix match)
4. Optional: severity, from/to, subject org UUID

Never expect passwords, reset tokens, or TOTP codes in metadata — only `outcome` and safe context.

### Common outcomes

| Event                   | Typical `metadata.outcome`                                         |
| ----------------------- | ------------------------------------------------------------------ |
| `auth.login_failed`     | `invalid_credentials`, `account_user_email_mismatch`, …            |
| `auth.login_pending`    | `requires_org_selection` (LMS; QMS also has `requires_onboarding`) |
| `auth.login_blocked`    | lockout / policy block                                             |
| `auth.password_reset_*` | request / fail / complete                                          |
| `auth.2fa_*`            | enable / disable / backup regenerate / login gate                  |

If forgot-password emits `account_user_email_mismatch`, align Account vs User email (same pattern as QMS `AUTH_ACCOUNT_EMAIL_MISMATCH`).

## Wired vs not (product scope)

**Emitted today:** login (incl. 2FA gate), password forgot/reset, register, email verify, logout / sessions revoked (logout + reset), 2FA enable/disable/backup regen, impersonation start/end.

**Constants exist but LMS has no endpoint yet** (intentional until product adds the flows):

- change-password → `auth.password_changed` / `auth.password_change_failed`
- resend-verification → `auth.email_verification_resent`
- change-email → `auth.email_change_*`

## Related monitoring surfaces

| Surface                                                           | URL / API                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| Audit Trail                                                       | Admin → `/audit`                                                    |
| Admin 2FA                                                         | Admin → `/security`                                                 |
| Pulse                                                             | Admin → `/pulse`                                                    |
| Infrastructure (release, migrations, Sentry / Better Stack links) | Admin → `/infrastructure` → `GET /platform-admin/deployment/status` |

## Deploy notes

- Railway service: **pl-admin** (`railway/admin.railway.json`) — keep **sleep disabled** (`sleepApplication: false`) so operators are not woken by cold starts
- API CORS: include `https://loyalty-admin.sysplat.com` in `APP_ALLOWED_ORIGINS` on **pl-api**
- After schema changes: `pnpm db:migrate:deploy:railway`
- Optional env for Infrastructure deep-links: `SENTRY_DASHBOARD_URL`, `BETTER_STACK_DASHBOARD_URL`, `BETTER_STACK_STATUS_URL`, `BETTER_STACK_LOGS_URL` (or `NEXT_PUBLIC_*` equivalents)
