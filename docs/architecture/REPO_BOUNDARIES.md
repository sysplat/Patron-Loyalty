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
- `check:architecture:lms-doc-boundaries` — no new `apps/web` / `apps/admin` refs without QMS sibling qualifier

QMS-only checks (`check:architecture:web-admin-boundary`, service-size budgets for ticket/workbench) run in the **QMS** repo.

## API deploy profile

| Variable             | Values           | Use                                                                 |
| -------------------- | ---------------- | ------------------------------------------------------------------- |
| `API_DEPLOY_PROFILE` | `full` (default) | Bundle / QMS deploy — all API modules                               |
| `API_DEPLOY_PROFILE` | `loyalty`        | Patron Loyalty `pl-api` — no ticket/queue/workbench modules at boot |

On `full` deploy, `QueueProductGuard` returns **404** for QMS route prefixes when the tenant org’s `productSku` is `loyalty` (no queue license).

## Product SKU matrix

| `Organization.productSku` | `patronCrmEnabled` | LMS UI | QMS UI | API modules (loyalty deploy)                    | QMS REST (loyalty deploy) |
| ------------------------- | ------------------ | ------ | ------ | ----------------------------------------------- | ------------------------- |
| `loyalty`                 | `true`             | Yes    | No     | Auth, org, customer, loyalty, billing, webhooks | **404** (modules omitted) |
| `qms`                     | `false`            | No     | Yes    | Full module set                                 | Yes (queue SKU)           |
| `bundle`                  | `true`             | Yes    | Yes    | Full module set                                 | Yes                       |

**Schema layers** (logical; single DB today):

| Layer   | Examples                                                      | Notes                                             |
| ------- | ------------------------------------------------------------- | ------------------------------------------------- |
| Core    | `organizations`, `users`, `roles`, `customers`                | Shared tenancy                                    |
| Loyalty | `loyalty_accounts`, `loyalty_point_ledger`, `loyalty_rewards` | Gated by `patronCrmEnabled`                       |
| QMS     | `tickets`, `queues`, `visits`, `desks`                        | Omitted at boot when `API_DEPLOY_PROFILE=loyalty` |

**Connector identity:** `customers.external_id` (unique per org) is the canonical QlessQ patron key; legacy `metadata.externalId` is backfilled and still read as fallback.

**LMS prod migrations:** `pnpm db:migrate:deploy:railway` against Patron-Loyalty Postgres after linking Railway (`pl-api` / database service).
