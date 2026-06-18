# Patron Loyalty (LMS)

Standalone **Patron Loyalty Management System** — CRM, points, tiers, rewards, campaigns, and patron portal.

Split from the [QlessQ](https://github.com/syslyto/QlessQ) monorepo. QlessQ handles queues; this product handles loyalty. They connect optionally via webhooks and the Integration API (see `docs/architecture/qlessq-integration.md`).

## Stack

| Piece                | Path                     | Port (local) |
| -------------------- | ------------------------ | ------------ |
| Staff + patron UI    | `apps/loyalty`           | **3003**     |
| API                  | `packages/api`           | **4000**     |
| Database             | `packages/database`      | Postgres     |
| Shared types         | `packages/shared`        | —            |
| Notifications worker | `packages/notifications` | (worker)     |

## Quick start

```bash
pnpm install
cp .env.example .env   # fill DATABASE_URL, JWT_*, etc.
pnpm start             # Railway migrate + Centrifugo + API + loyalty app
```

Local Postgres/Redis:

```bash
pnpm setup:env-local
pnpm docker:up
pnpm dev:full:local
```

SMS/email campaigns require a second terminal:

```bash
pnpm dev:notifications
```

**URLs:** loyalty UI http://localhost:3003 · API http://localhost:4000

## Product model

- **Sold separately** from QlessQ (`productSku: loyalty` or bundle)
- **Own Terms/Privacy** at `/terms`, `/privacy`, `/patron-terms`, `/patron-privacy`
- **Optional QlessQ link** — earn points from queue/appointment events when tenants use both products

## Commands

```bash
pnpm validate      # lint + typecheck + legal placeholders
pnpm typecheck
pnpm test
pnpm db:generate   # after Prisma schema changes
```

## Related

- Architecture: `docs/architecture/patron-loyalty.md`
- QlessQ integration: `docs/architecture/qlessq-integration.md`
- QlessQ sibling repo: `../QMS` (queue product)

## Deploy

Same pattern as QlessQ: Railway services for API + `apps/loyalty` Next.js app, shared Postgres/Redis. Use `LOYALTY_URL` / `NEXT_PUBLIC_LOYALTY_URL` for the staff app origin.
