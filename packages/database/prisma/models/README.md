# Prisma multi-file schema (preview)

Patron Loyalty uses Prisma 6 multi-file schemas. All `.prisma` files under `packages/database/prisma/` are merged at generate/migrate time.

| File                    | Layer                | Contents                                               |
| ----------------------- | -------------------- | ------------------------------------------------------ |
| `schema.prisma`         | Core + QMS           | Generator, datasource, org/auth/queue models           |
| `models/loyalty.prisma` | Loyalty + patron CRM | `Loyalty*`, `Crm*`, `ConsentLedgerEntry`, gamification |

**CLI:** scripts use `"prisma": { "schema": "prisma" }` in `package.json` so `prisma validate` loads the directory.

**Next splits (Phase 1):** extract QMS models to `models/qms.prisma`, core tenancy to `models/core.prisma`.

See [REPO_BOUNDARIES.md](../../docs/architecture/REPO_BOUNDARIES.md) for the product SKU matrix.
