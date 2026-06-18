# Super-Admin (QlessQ operator)

This document describes the **platform operator** surface: separate from any tenant’s dashboard, guarded on both the API and the web app.

## Who is a platform operator?

- **Primary:** Any user in organization slug **`queueplatform-internal`** (created via **Admin app → Admins** or bootstrap). No `PLATFORM_OPERATOR_EMAILS` entry is required for them on the API or Admin app.
- **Optional env** (`PLATFORM_OPERATOR_EMAILS` / `PLATFORM_OPERATOR_USER_IDS`): bootstrap or break-glass only.
- **Web tenant app** (`apps/web`): Prefer **`user.platformOperator`** from **`POST /auth/login`**, **`POST /auth/login/2fa`**, and **`POST /auth/refresh`**; use **`GET /auth/session`** if the persisted client never stored the flag. Optional `NEXT_PUBLIC_PLATFORM_OPERATOR_*` remains legacy UX only. Set **`NEXT_PUBLIC_ADMIN_URL`** for the sidebar “Platform admin” link target (defaults to `http://localhost:3002`).

## Routes

Platform operator routes are served only by **`apps/admin`**.

| Area                    | Path              |
| ----------------------- | ----------------- |
| Platform Pulse          | `/pulse`          |
| Support inbox           | `/support`        |
| Tenants + impersonation | `/tenants`        |
| Platform audit feed     | `/audit`          |
| Org health              | `/infrastructure` |
| Security controls       | `/security`       |
| Admin roster            | `/admins`         |
| Announcements           | `/announcements`  |

Tenant web (`apps/web`) no longer exposes `/superadmin*` or `/dashboard/operations/{support,tenants}` compatibility routes.

## API

All platform-admin endpoints are under **`/api/v1/platform-admin/...`** and require a normal JWT for a **platform operator** user, except where noted.

- **Impersonation**: `POST /platform-admin/impersonation/start` returns a **short-lived** access token (TTL from `JWT_IMPERSONATION_TTL`, default 900 seconds). The JWT payload includes impersonation claims; tenant APIs resolve `orgId` to the target organization. **`POST /platform-admin/impersonation/end`** must be called while still holding that impersonation JWT so the end event is audited; the tenant dashboard banner triggers this before restoring the prior session from `sessionStorage` (`qp-impersonation-backup`).

## Database

Migrations add (among others) `PlatformAuditEvent`, `OrgHealthSnapshot`, and `PlatformExportJob`. Apply with your usual Prisma workflow (`pnpm --filter @queueplatform/database exec prisma migrate deploy` in deployed environments).

## Security notes

- Do not rely on the Next.js UI alone: every sensitive action is enforced with **`PlatformOperatorGuard`** (or impersonation-aware JWT validation) on the API.
- Impersonation is high risk: keep TTL short, monitor `platform.impersonation.*` audit events, and keep the **`queueplatform-internal`** admin roster small; optional `PLATFORM_OPERATOR_*` env is for break-glass only.
- Purge and export tooling are compliance-sensitive; use dry-run and typed confirmation in production only after legal review.
