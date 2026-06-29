# Prisma multi-file schema (preview)

Patron Loyalty uses Prisma 6 multi-file schemas. All `.prisma` files under `packages/database/prisma/` are merged at generate/migrate time.

| File                          | Layer                | Contents                                                                |
| ----------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `schema.prisma`               | Shell                | Generator, datasource, layer index                                      |
| `models/core.prisma`          | Core tenancy         | Organization, auth, RBAC, branches, customers, settings, integrations   |
| `models/qms-services.prisma`  | QMS service catalog  | Services, categories, branch assignments, working hours, date overrides |
| `models/qms.prisma`           | QMS operations       | Queues, tickets, visits, appointments, display, branch flows, desks     |
| `models/loyalty.prisma`       | Loyalty + patron CRM | `Loyalty*`, `Crm*`, `ConsentLedgerEntry`, gamification                  |
| `models/billing.prisma`       | Billing              | Plans, subscriptions, invoices, payments, SMS credit purchases          |
| `models/notifications.prisma` | Notifications        | Templates, delivery queue, notification logs                            |
| `models/ops.prisma`           | Org & platform ops   | Support, audit, announcements, reviews, platform admin, suppressions    |

**CLI:** scripts use `"prisma": { "schema": "prisma" }` in `package.json` so `prisma validate` loads the directory.

See [REPO_BOUNDARIES.md](../../docs/architecture/REPO_BOUNDARIES.md) for the product SKU matrix.
