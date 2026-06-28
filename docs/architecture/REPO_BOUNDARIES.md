# Repository boundaries — Patron Loyalty (this repo)

This repository ships **Patron Loyalty (LMS)** only. QlessQ queue management lives in the sibling repo **`../QMS`**.

## What ships from this repo

| Surface                   | Path                     | Purpose                                                               |
| ------------------------- | ------------------------ | --------------------------------------------------------------------- |
| Loyalty staff + patron UI | `apps/loyalty`           | CRM, points, tiers, campaigns, integrations                           |
| Core API                  | `packages/api`           | NestJS API (includes loyalty + legacy QMS modules for bundle deploys) |
| Database                  | `packages/database`      | Unified Prisma schema (loyalty + QMS tables)                          |
| Shared contracts          | `packages/shared`        | Zod validators, enums, RBAC, integration events                       |
| Notifications worker      | `packages/notifications` | Email/SMS delivery                                                    |
| E2E smoke                 | `packages/e2e`           | Playwright against loyalty + API health                               |

## QMS-only (sibling `../QMS` repo — not in this workspace)

| Surface             | Typical path in QMS                     | Purpose                                           |
| ------------------- | --------------------------------------- | ------------------------------------------------- |
| Tenant / kiosk web  | `apps/web`                              | Queue dashboard, kiosk, lobby display, track/book |
| Platform admin      | `apps/admin`                            | Cross-tenant operator console                     |
| QlessQ connector UI | `apps/web` → loyalty connector settings | Links org to LMS `queue-events`                   |

When docs mention `apps/web`, `apps/admin`, `/kiosk`, `/display`, `/track`, or `/book` without a qualifier, assume **QMS** unless the doc explicitly says `apps/loyalty`.

## Integration between products

See [qlessq-integration.md](./qlessq-integration.md) for the HTTP connector (`POST /loyalty/integrations/v1/queue-events`), tenant linking, and idempotency rules.

## CI gates in this repo

`pnpm validate:ci` runs lint, typecheck, legal placeholders, plus:

- `security:check:public-safeguards`
- `security:check:tenant-isolation`
- `check:architecture:api-module-boundary`

QMS-only checks (`check:architecture:web-admin-boundary`, service-size budgets for ticket/workbench) run in the **QMS** repo.
