# Admin surface architecture

> **QMS-only:** `apps/web` and `apps/admin` ship from sibling repo **`../QMS`**, not this Patron Loyalty workspace. This doc describes QlessQ frontends; LMS operators use **`apps/loyalty`** here. See [REPO_BOUNDARIES.md](./REPO_BOUNDARIES.md).

QlessQ ships two Next.js frontends. This document is the ownership map for Phase 3 of the [architecture hardening plan](./10-10-plan.md) (phases 1–5 complete as of 2026-06-04).

## Apps and audiences

| App          | Port (local) | Audience                              | Purpose                                                                |
| ------------ | ------------ | ------------------------------------- | ---------------------------------------------------------------------- |
| `apps/web`   | 3000         | Tenant staff, customers, kiosk, lobby | Day-to-day queue operations, booking, tracking, tenant-scoped live ops |
| `apps/admin` | 3002         | Platform operators                    | Cross-tenant support, impersonation, infra, security, announcements    |

**Source of truth for platform operations:** `apps/admin` only. See also [superadmin.md](./superadmin.md).

## Route ownership

### Platform operator (`apps/admin`)

- `/pulse`, `/support`, `/tenants`, `/audit`, `/infrastructure`, `/security`, `/admins`, `/announcements`
- All UI that calls `/api/v1/platform-admin/*` (except the impersonation exit handoff described below)

### Tenant web (`apps/web`)

- Tenant dashboard, agent consoles, reports, settings, kiosk, lobby, public track/book flows
- **`/dashboard/operations`** — tenant **live operations board** (branch queue monitoring). Not platform support/tenants.
- **`/dashboard/support`** — tenant **support requests to the platform** (customer-of-SaaS tickets). Not the operator inbox in admin.

### Removed from tenant web (do not reintroduce)

- `/superadmin*`
- `/dashboard/operations/support` (platform support inbox)
- `/dashboard/operations/tenants` (platform tenant management)

CI enforces this via `pnpm check:architecture:web-admin-boundary`.

## API boundary in tenant web

Tenant web must not embed platform-admin features. The only allowed `/platform-admin/*` call from `apps/web` is:

- `POST /platform-admin/impersonation/end` — triggered from the impersonation banner when an operator ends a session and returns to admin.

Platform operators reach admin via **`NEXT_PUBLIC_ADMIN_URL`** (sidebar “Platform admin” link when `user.platformOperator` is true).

## Shared frontend package

Duplicated hooks and Centrifugo bootstrapping live in **`packages/frontend-core`**:

| Export                                                     | Used by                                           |
| ---------------------------------------------------------- | ------------------------------------------------- |
| `useTabVisible`                                            | web, admin                                        |
| `useRealtimeRecovery`                                      | web (via thin wrapper binding `getCentrifuge`)    |
| `getCentrifuge`, `disconnectCentrifuge`, channel listeners | web, admin                                        |
| `QlessqBrand`, `QlessqLogoMark`, `QlessqWordmark`          | web, admin (re-exported via `@/components/brand`) |

App-local `@/lib/*` files may re-export from `@queueplatform/frontend-core` to preserve import paths.

**Intentionally app-local** (different RBAC surfaces):

- `rbac-ui.ts` — tenant agent permissions vs org-wide admin branch filters
- `api.ts` / `auth-store.ts` — different route sets and session shapes
- Workbench/journey helpers — tenant agent domain only

## Adding a new platform feature

1. Implement API under `packages/api/.../platform-admin/`.
2. Build UI only in `apps/admin`.
3. Do not add platform routes or platform-admin API calls to `apps/web`.
4. Run `pnpm check:architecture:web-admin-boundary` before opening a PR.

## Adding a new tenant feature

1. Implement tenant API under the appropriate domain module.
2. Build UI in `apps/web` (or public/kiosk route groups as needed).
3. If the hook is identical in both apps, extract to `packages/frontend-core` first.
